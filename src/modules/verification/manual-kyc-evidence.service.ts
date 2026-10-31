import { randomUUID } from "node:crypto";
import type { ManualKycEvidenceKind, User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import type { KycEvidenceStore } from "../../infrastructure/kyc-evidence-storage/kyc-evidence-store.types.js";
import {
  MANUAL_KYC_ALLOWED_MIME_TYPES,
  cloudinaryDeliveryFormat,
  type ManualKycStoredContentType,
} from "./manual-kyc.constants.js";
import { computeManualEvidenceComplete } from "./manual-kyc-completeness.js";
import {
  isEvidenceKindAllowedForDocument,
  manualIdDocumentRequiresBackSide,
  manualIdDocumentTypeLabel,
} from "./manual-kyc-document-type.js";
import { buildManualEvidencePublicId } from "./manual-kyc-public-id.js";
import { assertManualSessionOwnedAndCurrent } from "./manual-kyc-session-policy.js";
import { ManualKycService } from "./manual-kyc.service.js";

function parseContentType(mime: string | undefined): ManualKycStoredContentType {
  if (!mime || !MANUAL_KYC_ALLOWED_MIME_TYPES.has(mime)) {
    throw new AppError("VALIDATION_ERROR", "Unsupported evidence file type", 400);
  }
  return mime as ManualKycStoredContentType;
}

export class ManualKycEvidenceService {
  private readonly manualKyc: ManualKycService;

  constructor(
    private readonly db: DatabaseClient,
    private readonly env: AppEnv,
    private readonly evidenceStore: KycEvidenceStore,
  ) {
    this.manualKyc = new ManualKycService(db, env);
  }

  async uploadEvidence(input: {
    user: User;
    sessionId: string;
    kind: ManualKycEvidenceKind;
    fileBuffer: Buffer;
    mimeType: string | undefined;
  }) {
    this.manualKyc.assertManualAuthorityEnabled();

    const session = await this.db.verificationSession.findFirst({
      where: {
        id: input.sessionId,
        userId: input.user.id,
        provider: "MANUAL",
      },
    });
    if (!session) {
      throw new AppError("NOT_FOUND", "Manual verification session not found", 404);
    }
    assertManualSessionOwnedAndCurrent({ user: input.user, session });

    if (!["PENDING_USER", "RESUBMISSION_REQUESTED"].includes(session.status)) {
      throw new AppError("CONFLICT", "Manual verification session is not accepting evidence", 409);
    }
    if (!session.manualIdDocumentType) {
      throw new AppError("CONFLICT", "Manual session is missing document type metadata", 409);
    }
    if (
      !isEvidenceKindAllowedForDocument({
        documentType: session.manualIdDocumentType,
        documentHasRearSide: session.manualIdDocumentHasRearSide,
        kind: input.kind,
      })
    ) {
      const requiresBack = manualIdDocumentRequiresBackSide({
        documentType: session.manualIdDocumentType,
        documentHasRearSide: session.manualIdDocumentHasRearSide,
      });
      throw new AppError(
        "VALIDATION_ERROR",
        requiresBack
          ? "Evidence kind is not allowed for this document type"
          : "Back-of-ID upload is not required for the selected document type",
        400,
      );
    }

    const contentType = parseContentType(input.mimeType);
    const evidenceId = randomUUID();
    const publicId = buildManualEvidencePublicId({
      folder: this.env.CLOUDINARY_KYC_EVIDENCE_FOLDER,
      userId: input.user.id,
      sessionId: session.id,
      kind: input.kind,
      evidenceId,
    });

    const existingRow = await this.db.manualVerificationEvidence.findUnique({
      where: {
        verificationSessionId_kind: {
          verificationSessionId: session.id,
          kind: input.kind,
        },
      },
    });
    const previousPublicId =
      existingRow && !existingRow.deletedAt ? existingRow.cloudinaryPublicId : null;

    const stored = await this.evidenceStore.putAuthenticatedEvidence({
      publicId,
      body: input.fileBuffer,
      contentType,
    });

    const result = await this.db.$transaction(async (tx) => {
      const evidence = await tx.manualVerificationEvidence.upsert({
        where: {
          verificationSessionId_kind: {
            verificationSessionId: session.id,
            kind: input.kind,
          },
        },
        create: {
          id: evidenceId,
          userId: input.user.id,
          verificationSessionId: session.id,
          kind: input.kind,
          cloudinaryPublicId: stored.publicId,
          contentType,
          byteSize: stored.bytes,
        },
        update: {
          cloudinaryPublicId: stored.publicId,
          contentType,
          byteSize: stored.bytes,
          deletedAt: null,
        },
      });

      const activeEvidence = await tx.manualVerificationEvidence.findMany({
        where: {
          verificationSessionId: session.id,
          deletedAt: null,
        },
        select: { kind: true },
      });
      const completeness = computeManualEvidenceComplete({
        manualIdDocumentType: session.manualIdDocumentType,
        manualIdDocumentHasRearSide: session.manualIdDocumentHasRearSide,
        uploadedKinds: activeEvidence.map((e) => e.kind),
      });

      if (completeness.evidenceComplete) {
        await tx.verificationSession.update({
          where: { id: session.id },
          data: { status: "IN_REVIEW" },
        });
      } else if (session.status === "IN_REVIEW") {
        await tx.verificationSession.update({
          where: { id: session.id },
          data: { status: "PENDING_USER" },
        });
      }

      return { evidence, completeness };
    });

    if (previousPublicId && previousPublicId !== stored.publicId) {
      await this.evidenceStore.deleteEvidence(previousPublicId).catch(() => undefined);
    }

    return {
      evidenceId: result.evidence.id,
      kind: result.evidence.kind,
      byteSize: result.evidence.byteSize,
      uploadedAt: result.evidence.createdAt.toISOString(),
      sessionReadyForStaffReview: result.completeness.evidenceComplete,
      requiredEvidenceKinds: result.completeness.requiredEvidenceKinds,
      missingEvidenceKinds: result.completeness.missingKinds,
      evidenceComplete: result.completeness.evidenceComplete,
    };
  }

  async listEvidenceForReview(reviewUserId: string) {
    this.manualKyc.assertManualAuthorityEnabled();

    const user = await this.db.user.findUnique({
      where: { id: reviewUserId },
      select: {
        id: true,
        identityVerificationSessionId: true,
        identityVerificationRevokedAt: true,
      },
    });
    if (!user) {
      return { items: [] as const };
    }

    const session = user.identityVerificationSessionId
      ? await this.db.verificationSession.findFirst({
          where: {
            id: user.identityVerificationSessionId,
            userId: user.id,
            provider: "MANUAL",
          },
        })
      : null;

    if (!session) {
      return { items: [] as const };
    }

    const rows = await this.db.manualVerificationEvidence.findMany({
      where: { verificationSessionId: session.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        kind: true,
        byteSize: true,
        contentType: true,
        createdAt: true,
      },
    });

    const completeness = computeManualEvidenceComplete({
      manualIdDocumentType: session.manualIdDocumentType,
      manualIdDocumentHasRearSide: session.manualIdDocumentHasRearSide,
      uploadedKinds: rows.map((row) => row.kind),
    });

    const sessionExpired = session.sessionExpiresAt.getTime() <= Date.now();

    return {
      sessionId: session.id,
      sessionStatus: session.status,
      sessionExpired,
      manualIdDocumentType: session.manualIdDocumentType,
      manualIdDocumentTypeLabel: session.manualIdDocumentType
        ? manualIdDocumentTypeLabel(session.manualIdDocumentType)
        : null,
      documentHasRearSide: session.manualIdDocumentHasRearSide,
      idDocumentBackRequired: session.manualIdDocumentType
        ? manualIdDocumentRequiresBackSide({
            documentType: session.manualIdDocumentType,
            documentHasRearSide: session.manualIdDocumentHasRearSide,
          })
        : false,
      requiredEvidenceKinds: completeness.requiredEvidenceKinds,
      evidenceComplete: completeness.evidenceComplete,
      missingEvidenceKinds: completeness.missingKinds,
      items: rows.map((row) => ({
        evidenceId: row.id,
        kind: row.kind,
        byteSize: row.byteSize,
        contentType: row.contentType,
        uploadedAt: row.createdAt.toISOString(),
      })),
    };
  }

  async fetchEvidenceBytesForStaff(input: { reviewUserId: string; evidenceId: string }) {
    this.manualKyc.assertManualAuthorityEnabled();
    const user = await this.db.user.findUnique({
      where: { id: input.reviewUserId },
      select: { identityVerificationSessionId: true },
    });
    if (!user) {
      throw new AppError("NOT_FOUND", "KYC evidence not found", 404);
    }

    const evidence = await this.db.manualVerificationEvidence.findFirst({
      where: {
        id: input.evidenceId,
        userId: input.reviewUserId,
        deletedAt: null,
      },
    });
    if (!evidence) {
      throw new AppError("NOT_FOUND", "KYC evidence not found", 404);
    }
    if (
      user.identityVerificationSessionId &&
      user.identityVerificationSessionId !== evidence.verificationSessionId
    ) {
      throw new AppError("NOT_FOUND", "KYC evidence not found", 404);
    }

    const storedContentType = parseContentType(evidence.contentType);
    const fetched = await this.evidenceStore.fetchAuthenticatedEvidence(
      evidence.cloudinaryPublicId,
      cloudinaryDeliveryFormat(storedContentType),
    );
    return {
      buffer: fetched.body,
      contentType: fetched.contentType,
    };
  }

  async deleteEvidenceForRetention(input: { reviewUserId: string; evidenceId: string }) {
    this.manualKyc.assertManualAuthorityEnabled();
    const evidence = await this.db.manualVerificationEvidence.findFirst({
      where: { id: input.evidenceId, userId: input.reviewUserId, deletedAt: null },
    });
    if (!evidence) {
      throw new AppError("NOT_FOUND", "KYC evidence not found", 404);
    }

    await this.evidenceStore.deleteEvidence(evidence.cloudinaryPublicId);
    await this.db.manualVerificationEvidence.update({
      where: { id: evidence.id },
      data: { deletedAt: new Date() },
    });

    const session = await this.db.verificationSession.findUnique({
      where: { id: evidence.verificationSessionId },
    });
    if (session?.manualIdDocumentType && session.status === "IN_REVIEW") {
      const activeEvidence = await this.db.manualVerificationEvidence.findMany({
        where: { verificationSessionId: session.id, deletedAt: null },
        select: { kind: true },
      });
      const completeness = computeManualEvidenceComplete({
        manualIdDocumentType: session.manualIdDocumentType,
        manualIdDocumentHasRearSide: session.manualIdDocumentHasRearSide,
        uploadedKinds: activeEvidence.map((row) => row.kind),
      });
      if (!completeness.evidenceComplete) {
        await this.db.verificationSession.update({
          where: { id: session.id },
          data: { status: "PENDING_USER" },
        });
      }
    }
  }
}
