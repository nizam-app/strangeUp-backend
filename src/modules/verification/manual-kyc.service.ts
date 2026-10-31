import { randomUUID } from "node:crypto";
import type { ManualIdDocumentType, User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { resolveKycIdentityAuthority } from "./kyc-identity-authority.js";
import { computeManualEvidenceComplete } from "./manual-kyc-completeness.js";
import {
  manualIdDocumentRequiresBackSide,
  manualIdDocumentTypeLabel,
  requiredManualEvidenceKinds,
} from "./manual-kyc-document-type.js";
import { assertManualSessionOwnedAndCurrent } from "./manual-kyc-session-policy.js";
import { canStartVerification, isTerminalUserKyc } from "./verification-policy.js";
import { toPolicyActor } from "../policy/account-policy.js";

const BLOCKING_MANUAL_STATUSES = ["PENDING_USER", "IN_REVIEW", "RESUBMISSION_REQUESTED"] as const;

export class ManualKycService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly env: AppEnv,
  ) {}

  assertManualAuthorityEnabled(): void {
    const authority = resolveKycIdentityAuthority(this.env);
    if (!authority.manualReviewAllowed) {
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "Manual identity verification is not configured",
        503,
      );
    }
  }

  async startManualSession(
    user: User,
    input: { idDocumentType: ManualIdDocumentType; documentHasRearSide?: boolean },
  ) {
    this.assertManualAuthorityEnabled();

    if (user.identityVerificationRevokedAt) {
      throw new AppError("AUTH_FORBIDDEN", "Identity verification is revoked", 403);
    }

    if (!canStartVerification(toPolicyActor(user), user) || isTerminalUserKyc(user)) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Not eligible to start manual identity verification",
        403,
      );
    }

    const active = await this.db.verificationSession.findFirst({
      where: {
        userId: user.id,
        provider: "MANUAL",
        status: { in: [...BLOCKING_MANUAL_STATUSES] },
        sessionExpiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (active) {
      throw new AppError("CONFLICT", "An active manual verification session already exists", 409);
    }

    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + this.env.KYC_SESSION_TTL_SECONDS * 1000);
    const providerSessionRef = `manual-${sessionId}`;

    const session = await this.db.$transaction(async (tx) => {
      const created = await tx.verificationSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          provider: "MANUAL",
          providerSessionRef,
          status: "PENDING_USER",
          manualIdDocumentType: input.idDocumentType,
          manualIdDocumentHasRearSide: input.documentHasRearSide ?? null,
          sessionExpiresAt: expiresAt,
        },
      });

      const userPatch: {
        identityVerificationStatus?: "PENDING";
        adminReviewStatus?: "NOT_READY";
        adminReviewVerificationSessionId?: null;
        adminReviewDecidedAt?: null;
        identityVerificationSessionId?: string;
      } = {
        identityVerificationSessionId: created.id,
      };

      if (user.identityVerificationStatus === "NOT_STARTED") {
        userPatch.identityVerificationStatus = "PENDING";
      }
      if (user.adminReviewStatus !== "NOT_READY") {
        userPatch.adminReviewStatus = "NOT_READY";
        userPatch.adminReviewVerificationSessionId = null;
        userPatch.adminReviewDecidedAt = null;
      }

      await tx.user.update({ where: { id: user.id }, data: userPatch });
      return created;
    });

    const requiredEvidenceKinds = requiredManualEvidenceKinds({
      documentType: input.idDocumentType,
      documentHasRearSide: input.documentHasRearSide,
    });

    return {
      sessionId: session.id,
      status: session.status,
      clientAction: "MANUAL_EVIDENCE_UPLOAD" as const,
      idDocumentType: input.idDocumentType,
      idDocumentTypeLabel: manualIdDocumentTypeLabel(input.idDocumentType),
      documentHasRearSide: input.documentHasRearSide ?? null,
      idDocumentBackRequired: manualIdDocumentRequiresBackSide({
        documentType: input.idDocumentType,
        documentHasRearSide: input.documentHasRearSide,
      }),
      requiredEvidenceKinds,
      expiresAt: session.sessionExpiresAt.toISOString(),
    };
  }

  async getManualSession(user: User, sessionId: string) {
    this.assertManualAuthorityEnabled();
    const session = await this.db.verificationSession.findFirst({
      where: { id: sessionId, userId: user.id, provider: "MANUAL" },
    });
    if (!session) {
      throw new AppError("NOT_FOUND", "Manual verification session not found", 404);
    }
    assertManualSessionOwnedAndCurrent({ user, session });

    const evidence = await this.db.manualVerificationEvidence.findMany({
      where: { verificationSessionId: session.id, deletedAt: null },
      select: { kind: true, id: true, byteSize: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const completeness = computeManualEvidenceComplete({
      manualIdDocumentType: session.manualIdDocumentType,
      manualIdDocumentHasRearSide: session.manualIdDocumentHasRearSide,
      uploadedKinds: evidence.map((row) => row.kind),
    });

    return {
      sessionId: session.id,
      status: session.status,
      idDocumentType: session.manualIdDocumentType,
      idDocumentTypeLabel: session.manualIdDocumentType
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
      uploadedEvidence: evidence.map((row) => ({
        evidenceId: row.id,
        kind: row.kind,
        byteSize: row.byteSize,
        uploadedAt: row.createdAt.toISOString(),
      })),
      expiresAt: session.sessionExpiresAt.toISOString(),
      identityVerificationStatus: user.identityVerificationStatus,
    };
  }

  async cancelManualSession(user: User, sessionId: string) {
    this.assertManualAuthorityEnabled();
    const session = await this.db.verificationSession.findFirst({
      where: { id: sessionId, userId: user.id, provider: "MANUAL" },
    });
    if (!session) {
      throw new AppError("NOT_FOUND", "Manual verification session not found", 404);
    }
    if (!["PENDING_USER", "RESUBMISSION_REQUESTED"].includes(session.status)) {
      throw new AppError("CONFLICT", "Manual verification session cannot be cancelled now", 409);
    }
    assertManualSessionOwnedAndCurrent({ user, session });

    await this.db.$transaction(async (tx) => {
      await tx.verificationSession.update({
        where: { id: session.id },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
      if (user.identityVerificationSessionId === session.id) {
        await tx.user.update({
          where: { id: user.id },
          data: { identityVerificationSessionId: null },
        });
      }
    });

    return { status: "CANCELLED" as const };
  }
}
