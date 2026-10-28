import { randomUUID } from "node:crypto";
import type { StrangeUpAdminReviewStatus, User } from "../../../generated/prisma/client.js";
import { AppError, type AppErrorCode } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { buildConsentRegistryContext } from "../consent/consent-context.js";
import { userRegistrationConsentsSatisfyRegistry } from "../consent/canonical-consent-registry.js";
import {
  hasTrustedKycForEnforcement,
  type KycEnforcementContext,
} from "../verification/kyc-trust.js";
import { resolveVerificationRuntimeConfig } from "../verification/verification-config.js";
import { isAdminIdentityReviewRejectReasonCode } from "./admin-review-reason-codes.js";

export type IdentityReviewListStatus = "PENDING" | "APPROVED" | "REJECTED";

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) {
    return "***";
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

function buildKycCtx(env: AppEnv): KycEnforcementContext {
  const cfg = resolveVerificationRuntimeConfig(env);
  return {
    isProduction: env.isProduction,
    kycProviderEnabled: cfg.providerEnabled,
  };
}

export class IdentityAdminReviewService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly env: AppEnv,
  ) {}

  async listReviews(input: {
    status: IdentityReviewListStatus;
    limit: number;
    cursor?: string;
  }) {
    const adminStatus: StrangeUpAdminReviewStatus = input.status;
    const take = input.limit + 1;
    const cursor = decodeCursor(input.cursor);

    const rows = await this.db.user.findMany({
      where: {
        adminReviewStatus: adminStatus,
        ...(adminStatus === "PENDING"
          ? {
              identityVerificationStatus: "APPROVED",
              identityVerificationSessionId: { not: null },
              adminReviewVerificationSessionId: { not: null },
            }
          : {}),
        ...(cursor
          ? {
              AND: [
                {
                  OR: [
                    { updatedAt: { lt: cursor.updatedAt } },
                    {
                      AND: [{ updatedAt: cursor.updatedAt }, { id: { lt: cursor.userId } }],
                    },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take,
      select: {
        id: true,
        email: true,
        accountStatus: true,
        emailVerifiedAt: true,
        ageEligibilityStatus: true,
        identityVerificationStatus: true,
        adminReviewStatus: true,
        identityVerificationSessionId: true,
        adminReviewVerificationSessionId: true,
        adminReviewDecidedAt: true,
        updatedAt: true,
      },
    });

    const page = rows.slice(0, input.limit);
    const nextCursor =
      rows.length > input.limit && page.length > 0
        ? encodeCursor({
            updatedAt: page[page.length - 1].updatedAt,
            userId: page[page.length - 1].id,
          })
        : null;

    return {
      reviews: page.map((row) => ({
        reviewId: row.id,
        maskedEmail: maskEmail(row.email),
        accountStatus: row.accountStatus,
        emailVerified: row.emailVerifiedAt !== null,
        ageEligibilityStatus: row.ageEligibilityStatus,
        identityVerificationStatus: row.identityVerificationStatus,
        adminReviewStatus: row.adminReviewStatus,
        verificationSessionId: row.identityVerificationSessionId,
        adminReviewDecidedAt: row.adminReviewDecidedAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async getReviewDetail(reviewId: string) {
    const user = await this.db.user.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        email: true,
        accountStatus: true,
        emailVerifiedAt: true,
        ageEligibilityStatus: true,
        identityVerificationStatus: true,
        identityVerificationApprovedAt: true,
        identityVerificationValidUntil: true,
        identityVerificationRevokedAt: true,
        identityVerificationSessionId: true,
        adminReviewStatus: true,
        adminReviewVerificationSessionId: true,
        adminReviewDecidedAt: true,
        suspendedAt: true,
        deletedAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      throw new AppError("NOT_FOUND", "Identity review not found", 404);
    }

    const session =
      user.identityVerificationSessionId &&
      (await this.db.verificationSession.findFirst({
        where: { id: user.identityVerificationSessionId, userId: user.id },
        select: {
          id: true,
          status: true,
          provider: true,
          completedAt: true,
          sessionExpiresAt: true,
          updatedAt: true,
        },
      }));

    const recentDecisions = await this.db.identityAdminReviewDecision.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        reasonCode: true,
        verificationSessionId: true,
        reviewerUserId: true,
        createdAt: true,
      },
    });

    return {
      reviewId: user.id,
      maskedEmail: maskEmail(user.email),
      accountStatus: user.accountStatus,
      emailVerified: user.emailVerifiedAt !== null,
      ageEligibilityStatus: user.ageEligibilityStatus,
      identityVerificationStatus: user.identityVerificationStatus,
      adminReviewStatus: user.adminReviewStatus,
      verificationSession: session
        ? {
            sessionId: session.id,
            status: session.status,
            provider: session.provider,
            completedAt: session.completedAt?.toISOString() ?? null,
            expiresAt: session.sessionExpiresAt.toISOString(),
            updatedAt: session.updatedAt.toISOString(),
          }
        : null,
      providerIdentityApprovedAt: user.identityVerificationApprovedAt?.toISOString() ?? null,
      identityValidUntil: user.identityVerificationValidUntil?.toISOString() ?? null,
      identityRevokedAt: user.identityVerificationRevokedAt?.toISOString() ?? null,
      adminReviewDecidedAt: user.adminReviewDecidedAt?.toISOString() ?? null,
      recentDecisions: recentDecisions.map((d) => ({
        decisionId: d.id,
        status: d.status,
        reasonCode: d.reasonCode,
        verificationSessionId: d.verificationSessionId,
        reviewerUserId: d.reviewerUserId,
        createdAt: d.createdAt.toISOString(),
      })),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async approveReview(input: {
    reviewer: User;
    reviewId: string;
    idempotencyKey?: string;
  }) {
    if (input.reviewer.id === input.reviewId) {
      throw new AppError("AUTH_FORBIDDEN", "Administrators cannot review their own identity", 403);
    }

    const kycCtx = buildKycCtx(this.env);
    const verificationConfig = resolveVerificationRuntimeConfig(this.env);
    if (this.env.isProduction && verificationConfig.provider === "MOCK") {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Identity approval is not available with mock provider in production",
        403,
      );
    }

    if (input.idempotencyKey) {
      const prior = await this.db.identityAdminReviewDecision.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (prior) {
        const user = await this.db.user.findUniqueOrThrow({ where: { id: input.reviewId } });
        return {
          reviewId: user.id,
          adminReviewStatus: user.adminReviewStatus,
          idempotentReplay: true as const,
        };
      }
    }

    return this.db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: input.reviewId } });
      if (!user) {
        throw new AppError("NOT_FOUND", "Identity review not found", 404);
      }

      const eligibility = await this.evaluateApprovalEligibility(user, kycCtx, tx);
      if (!eligibility.ok) {
        throw new AppError(eligibility.code, eligibility.message, eligibility.status);
      }

      const sessionId = user.identityVerificationSessionId!;
      const session = await tx.verificationSession.findFirst({
        where: { id: sessionId, userId: user.id },
      });
      if (!session || session.status !== "APPROVED") {
        throw new AppError(
          "CONFLICT",
          "Provider verification session is not in an approvable state",
          409,
        );
      }

      if (user.adminReviewStatus === "APPROVED" && user.adminReviewVerificationSessionId === sessionId) {
        return {
          reviewId: user.id,
          adminReviewStatus: user.adminReviewStatus,
          idempotentReplay: true as const,
        };
      }

      if (user.adminReviewStatus !== "PENDING") {
        throw new AppError(
          "CONFLICT",
          "Identity review is not pending administrator action",
          409,
        );
      }

      const now = new Date();
      const applied = await tx.user.updateMany({
        where: { id: user.id, adminReviewStatus: "PENDING" },
        data: {
          adminReviewStatus: "APPROVED",
          adminReviewVerificationSessionId: sessionId,
          adminReviewDecidedAt: now,
        },
      });
      if (applied.count !== 1) {
        throw new AppError(
          "CONFLICT",
          "Identity review was updated by another administrator",
          409,
        );
      }

      await tx.identityAdminReviewDecision.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          verificationSessionId: sessionId,
          status: "APPROVED",
          reviewerUserId: input.reviewer.id,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });

      return {
        reviewId: user.id,
        adminReviewStatus: "APPROVED" as const,
        idempotentReplay: false as const,
      };
    });
  }

  async rejectReview(input: {
    reviewer: User;
    reviewId: string;
    reasonCode: string;
    idempotencyKey?: string;
  }) {
    if (!isAdminIdentityReviewRejectReasonCode(input.reasonCode)) {
      throw new AppError("VALIDATION_ERROR", "Invalid rejection reason code", 400);
    }
    if (input.reviewer.id === input.reviewId) {
      throw new AppError("AUTH_FORBIDDEN", "Administrators cannot review their own identity", 403);
    }

    if (input.idempotencyKey) {
      const prior = await this.db.identityAdminReviewDecision.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (prior) {
        const user = await this.db.user.findUniqueOrThrow({ where: { id: input.reviewId } });
        return {
          reviewId: user.id,
          adminReviewStatus: user.adminReviewStatus,
          idempotentReplay: true as const,
        };
      }
    }

    return this.db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: input.reviewId } });
      if (!user) {
        throw new AppError("NOT_FOUND", "Identity review not found", 404);
      }

      if (user.adminReviewStatus === "REJECTED") {
        return {
          reviewId: user.id,
          adminReviewStatus: user.adminReviewStatus,
          idempotentReplay: true as const,
        };
      }

      if (user.adminReviewStatus !== "PENDING") {
        throw new AppError(
          "CONFLICT",
          "Identity review is not pending administrator action",
          409,
        );
      }

      const sessionId = user.adminReviewVerificationSessionId ?? user.identityVerificationSessionId;
      if (!sessionId) {
        throw new AppError("CONFLICT", "No verification session bound to this review", 409);
      }

      const now = new Date();
      const applied = await tx.user.updateMany({
        where: { id: user.id, adminReviewStatus: "PENDING" },
        data: {
          adminReviewStatus: "REJECTED",
          adminReviewVerificationSessionId: sessionId,
          adminReviewDecidedAt: now,
        },
      });
      if (applied.count !== 1) {
        throw new AppError(
          "CONFLICT",
          "Identity review was updated by another administrator",
          409,
        );
      }

      await tx.identityAdminReviewDecision.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          verificationSessionId: sessionId,
          status: "REJECTED",
          reasonCode: input.reasonCode,
          reviewerUserId: input.reviewer.id,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });

      return {
        reviewId: user.id,
        adminReviewStatus: "REJECTED" as const,
        idempotentReplay: false as const,
      };
    });
  }

  private async evaluateApprovalEligibility(
    user: User,
    kycCtx: KycEnforcementContext,
    db: Pick<DatabaseClient, "consentRecord"> = this.db,
  ): Promise<
    | { ok: true }
    | { ok: false; code: AppErrorCode; message: string; status: number }
  > {
    if (
      user.deletedAt ||
      user.suspendedAt ||
      user.accountStatus === "DELETED" ||
      user.accountStatus === "SUSPENDED"
    ) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Account is not eligible for activation",
        status: 403,
      };
    }
    if (user.accountStatus !== "ACTIVE" || !user.emailVerifiedAt) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Email verification and active account are required",
        status: 403,
      };
    }
    if (user.ageEligibilityStatus !== "ELIGIBLE") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Age eligibility requirements are not satisfied",
        status: 403,
      };
    }

    const consentCtx = buildConsentRegistryContext(this.env);
    const consents = await db.consentRecord.findMany({
      where: { userId: user.id },
      select: { consentType: true, documentId: true, documentVersion: true },
    });
    const consentCheck = userRegistrationConsentsSatisfyRegistry(consents, consentCtx);
    if (!consentCheck.ok) {
      return {
        ok: false,
        code: consentCheck.code === "CONSENT_VERSION_UNAVAILABLE" ? "SERVICE_UNAVAILABLE" : "AUTH_FORBIDDEN",
        message: consentCheck.message,
        status: consentCheck.code === "CONSENT_VERSION_UNAVAILABLE" ? 503 : 403,
      };
    }

    if (
      !hasTrustedKycForEnforcement(
        {
          identityVerificationStatus: user.identityVerificationStatus,
          identityVerificationApprovedAt: user.identityVerificationApprovedAt,
          identityVerificationValidUntil: user.identityVerificationValidUntil,
          identityVerificationRevokedAt: user.identityVerificationRevokedAt,
        },
        kycCtx,
      )
    ) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Trusted provider identity approval is required",
        status: 403,
      };
    }

    if (
      !user.identityVerificationSessionId ||
      !user.adminReviewVerificationSessionId ||
      user.identityVerificationSessionId !== user.adminReviewVerificationSessionId
    ) {
      return {
        ok: false,
        code: "CONFLICT",
        message: "Admin review session does not match current provider verification session",
        status: 409,
      };
    }

    return { ok: true };
  }
}

function encodeCursor(value: { updatedAt: Date; userId: string }): string {
  return Buffer.from(
    JSON.stringify({ u: value.updatedAt.toISOString(), i: value.userId }),
    "utf8",
  ).toString("base64url");
}

function decodeCursor(raw?: string): { updatedAt: Date; userId: string } | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      u?: string;
      i?: string;
    };
    if (!parsed.u || !parsed.i) {
      return null;
    }
    return { updatedAt: new Date(parsed.u), userId: parsed.i };
  } catch {
    return null;
  }
}
