import { randomUUID } from "node:crypto";
import type { User, VerificationSessionStatus } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { computeManualEvidenceComplete } from "./manual-kyc-completeness.js";
import { mapProviderDecisionToUserStatus } from "./kyc-trust.js";
import { ManualKycService } from "./manual-kyc.service.js";

export type ManualIdentityStaffDecision = "APPROVE" | "REJECT";

export class ManualKycIdentityDecisionService {
  private readonly manualKyc: ManualKycService;

  constructor(
    private readonly db: DatabaseClient,
    env: AppEnv,
  ) {
    this.manualKyc = new ManualKycService(db, env);
  }

  async applyStaffIdentityDecision(input: {
    reviewer: User;
    reviewUserId: string;
    decision: ManualIdentityStaffDecision;
    reasonCode?: string;
  }) {
    if (input.reviewer.id === input.reviewUserId) {
      throw new AppError("AUTH_FORBIDDEN", "Administrators cannot review their own identity", 403);
    }
    this.manualKyc.assertManualAuthorityEnabled();

    const decisionStatus: VerificationSessionStatus =
      input.decision === "APPROVE" ? "APPROVED" : "DECLINED";
    const providerEventId = `manual-staff-${randomUUID()}`;
    const decisionAt = new Date();

    return this.db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: input.reviewUserId } });
      if (!user) {
        throw new AppError("NOT_FOUND", "Identity review not found", 404);
      }

      const sessionId = user.identityVerificationSessionId;
      if (!sessionId) {
        throw new AppError("CONFLICT", "No manual verification session is bound to this user", 409);
      }

      const session = await tx.verificationSession.findFirst({
        where: { id: sessionId, userId: user.id, provider: "MANUAL" },
      });
      if (!session) {
        throw new AppError("CONFLICT", "Active manual verification session not found", 409);
      }
      if (session.status !== "IN_REVIEW") {
        throw new AppError(
          "CONFLICT",
          "Manual verification session is not awaiting staff identity decision",
          409,
        );
      }
      if (session.sessionExpiresAt.getTime() <= Date.now()) {
        throw new AppError("CONFLICT", "Manual verification session has expired", 409);
      }
      if (user.identityVerificationRevokedAt) {
        throw new AppError("AUTH_FORBIDDEN", "Identity verification is revoked", 403);
      }

      const evidenceRows = await tx.manualVerificationEvidence.findMany({
        where: { verificationSessionId: session.id, deletedAt: null },
        select: { kind: true },
      });
      const completeness = computeManualEvidenceComplete({
        manualIdDocumentType: session.manualIdDocumentType,
        manualIdDocumentHasRearSide: session.manualIdDocumentHasRearSide,
        uploadedKinds: evidenceRows.map((row) => row.kind),
      });
      if (input.decision === "APPROVE" && !completeness.evidenceComplete) {
        throw new AppError(
          "CONFLICT",
          "Required manual identity evidence is incomplete; approval is blocked",
          409,
        );
      }

      const nextSequence = session.authoritySequence + BigInt(1);
      await tx.verificationDecision.create({
        data: {
          id: randomUUID(),
          sessionId: session.id,
          providerEventId,
          decisionStatus,
          decisionAt,
          authoritySequence: nextSequence,
        },
      });

      await tx.verificationSession.update({
        where: { id: session.id },
        data: {
          status: decisionStatus,
          authoritySequence: nextSequence,
          completedAt: decisionAt,
          providerAttemptRef: providerEventId,
        },
      });

      const mappedUserStatus = mapProviderDecisionToUserStatus(decisionStatus);
      if (!mappedUserStatus) {
        throw new AppError("INTERNAL_ERROR", "Unable to map manual identity decision", 500);
      }

      const userUpdate: {
        identityVerificationStatus: typeof mappedUserStatus;
        identityVerificationApprovedAt?: Date | null;
        identityVerificationValidUntil?: Date | null;
        identityVerificationRevokedAt?: Date | null;
        identityVerificationSessionId?: string | null;
        adminReviewStatus?:
          | "NOT_READY"
          | "PENDING"
          | "NEEDS_FURTHER_REVIEW"
          | "APPROVED"
          | "REJECTED"
          | "NEEDS_MORE_INFO";
        adminReviewVerificationSessionId?: string | null;
        adminReviewDecidedAt?: Date | null;
      } = {
        identityVerificationStatus: mappedUserStatus,
      };

      if (mappedUserStatus === "APPROVED") {
        userUpdate.identityVerificationApprovedAt = decisionAt;
        userUpdate.identityVerificationRevokedAt = null;
        userUpdate.identityVerificationSessionId = session.id;
        userUpdate.adminReviewStatus = "PENDING";
        userUpdate.adminReviewVerificationSessionId = session.id;
        userUpdate.adminReviewDecidedAt = null;
      } else {
        userUpdate.identityVerificationApprovedAt = null;
        userUpdate.identityVerificationValidUntil = null;
        userUpdate.identityVerificationSessionId = null;
        userUpdate.adminReviewStatus = "NOT_READY";
        userUpdate.adminReviewVerificationSessionId = null;
        userUpdate.adminReviewDecidedAt = null;
      }

      await tx.user.update({ where: { id: user.id }, data: userUpdate });

      return {
        reviewId: user.id,
        sessionId: session.id,
        identityVerificationStatus: mappedUserStatus,
        adminReviewStatus: userUpdate.adminReviewStatus ?? user.adminReviewStatus,
        staffReasonCode: input.reasonCode ?? null,
        source: "MANUAL_REVIEW" as const,
      };
    });
  }
}
