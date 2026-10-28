import { randomUUID } from "node:crypto";
import type {
  User,
  VerificationProvider,
  VerificationSessionStatus,
} from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { createMockProviderSession } from "./mock-provider.js";
import { createVeriffProviderSession } from "./veriff-provider.js";
import {
  canStartVerificationSession,
  resolveVerificationRuntimeConfig,
  type VerificationRuntimeConfig,
} from "./verification-config.js";
import { canStartVerification, isTerminalUserKyc } from "./verification-policy.js";
import { toPolicyActor } from "../policy/account-policy.js";
import type { MockWebhookBody } from "./verification.validation.js";
import { mapProviderDecisionToUserStatus } from "./kyc-trust.js";
import { verifyHmacSha256Hex } from "./webhook-signature.js";
import { mockWebhookBodySchema } from "./verification.validation.js";

const ACTIVE_SESSION_STATUSES: VerificationSessionStatus[] = [
  "PENDING_USER",
  "PENDING_PROVIDER",
  "IN_REVIEW",
  "RESUBMISSION_REQUESTED",
];

function mapMockStatusToSessionStatus(
  status: MockWebhookBody["verification"]["status"],
): VerificationSessionStatus {
  switch (status) {
    case "approved":
      return "APPROVED";
    case "declined":
      return "DECLINED";
    case "resubmission_requested":
      return "RESUBMISSION_REQUESTED";
    case "review":
      return "IN_REVIEW";
    case "expired":
      return "EXPIRED";
    case "abandoned":
      return "ABANDONED";
    default:
      return "PENDING_PROVIDER";
  }
}

function sessionStatusRank(status: VerificationSessionStatus): number {
  const ranks: Record<VerificationSessionStatus, number> = {
    PENDING_USER: 10,
    PENDING_PROVIDER: 20,
    RESUBMISSION_REQUESTED: 30,
    IN_REVIEW: 40,
    APPROVED: 100,
    DECLINED: 90,
    EXPIRED: 80,
    ABANDONED: 70,
    CANCELLED: 60,
  };
  return ranks[status] ?? 0;
}

export class VerificationService {
  private readonly config: VerificationRuntimeConfig;

  constructor(
    private readonly db: DatabaseClient,
    env: AppEnv,
  ) {
    this.config = resolveVerificationRuntimeConfig(env);
  }

  getRuntimeConfig(): VerificationRuntimeConfig {
    return this.config;
  }

  async getSelfServiceStatus(user: User) {
    const latest = await this.db.verificationSession.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        provider: true,
        sessionExpiresAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      providerRuntimeStatus: this.config.runtimeStatus,
      providerEnabled: this.config.providerEnabled,
      canStartVerification:
        canStartVerificationSession(this.config) &&
        canStartVerification(toPolicyActor(user), user) &&
        !isTerminalUserKyc(user),
      identityVerificationStatus: user.identityVerificationStatus,
      identityVerificationApprovedAt: user.identityVerificationApprovedAt?.toISOString() ?? null,
      identityVerificationValidUntil: user.identityVerificationValidUntil?.toISOString() ?? null,
      identityVerificationRevokedAt: user.identityVerificationRevokedAt?.toISOString() ?? null,
      latestSession: latest
        ? {
            sessionId: latest.id,
            status: latest.status,
            provider: latest.provider,
            expiresAt: latest.sessionExpiresAt.toISOString(),
            completedAt: latest.completedAt?.toISOString() ?? null,
            startedAt: latest.createdAt.toISOString(),
            updatedAt: latest.updatedAt.toISOString(),
          }
        : null,
    };
  }

  async startSession(user: User, input: { locale?: string }) {
    if (!canStartVerificationSession(this.config)) {
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        this.config.providerEnabled
          ? "Identity verification provider is not configured"
          : "Identity verification is disabled",
        503,
      );
    }

    if (
      !canStartVerification(toPolicyActor(user), user)
    ) {
      throw new AppError("AUTH_FORBIDDEN", "Not eligible to start identity verification", 403);
    }

    if (isTerminalUserKyc(user)) {
      throw new AppError("CONFLICT", "Identity verification is already approved", 409);
    }

    const active = await this.db.verificationSession.findFirst({
      where: {
        userId: user.id,
        status: { in: ACTIVE_SESSION_STATUSES },
        sessionExpiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (active) {
      throw new AppError("CONFLICT", "An active verification session already exists", 409);
    }

    const provider = this.config.provider;
    if (!provider) {
      throw new AppError("SERVICE_UNAVAILABLE", "Verification provider not configured", 503);
    }

    const expiresAt = new Date(Date.now() + this.config.sessionTtlSeconds * 1000);
    let providerSessionRef: string;
    let sdkToken: string;
    let redirectUrl: string | null;

    if (provider === "MOCK") {
      const mock = createMockProviderSession(this.config);
      providerSessionRef = mock.providerSessionRef;
      sdkToken = mock.sdkToken;
      redirectUrl = mock.redirectUrl;
    } else {
      await createVeriffProviderSession(this.config, {
        userId: user.id,
        locale: input.locale,
      });
      throw new AppError("SERVICE_UNAVAILABLE", "Verification provider not configured", 503);
    }

    const session = await this.db.$transaction(async (tx) => {
      const created = await tx.verificationSession.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          provider,
          providerSessionRef,
          status: "PENDING_USER",
          sessionExpiresAt: expiresAt,
        },
      });

      const userPatch: {
        identityVerificationStatus?: "PENDING";
        adminReviewStatus?: "NOT_READY";
        adminReviewVerificationSessionId?: null;
        adminReviewDecidedAt?: null;
      } = {};

      if (user.identityVerificationStatus === "NOT_STARTED") {
        userPatch.identityVerificationStatus = "PENDING";
      }

      if (
        user.identityVerificationStatus !== "APPROVED" &&
        user.adminReviewStatus !== "NOT_READY"
      ) {
        userPatch.adminReviewStatus = "NOT_READY";
        userPatch.adminReviewVerificationSessionId = null;
        userPatch.adminReviewDecidedAt = null;
      }

      if (Object.keys(userPatch).length > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: userPatch,
        });
      }

      return created;
    });

    return {
      sessionId: session.id,
      status: session.status,
      clientAction: "SDK" as const,
      sdkToken,
      redirectUrl,
      expiresAt: session.sessionExpiresAt.toISOString(),
    };
  }

  async getSession(user: User, sessionId: string) {
    const session = await this.db.verificationSession.findFirst({
      where: { id: sessionId, userId: user.id },
    });
    if (!session) {
      throw new AppError("NOT_FOUND", "Verification session not found", 404);
    }

    return {
      sessionId: session.id,
      status: session.status,
      identityVerificationStatus: user.identityVerificationStatus,
      startedAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      expiresAt: session.sessionExpiresAt.toISOString(),
    };
  }

  async cancelSession(user: User, sessionId: string) {
    const session = await this.db.verificationSession.findFirst({
      where: { id: sessionId, userId: user.id },
    });
    if (!session) {
      throw new AppError("NOT_FOUND", "Verification session not found", 404);
    }
    if (!ACTIVE_SESSION_STATUSES.includes(session.status)) {
      throw new AppError("CONFLICT", "Session cannot be cancelled in its current state", 409);
    }

    await this.db.verificationSession.update({
      where: { id: session.id },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
      },
    });

    return { status: "CANCELLED" as const };
  }

  async processMockWebhook(rawBody: Buffer, signature: string | undefined) {
    const secret = this.config.mockWebhookSecret;
    if (!secret) {
      throw new AppError("SERVICE_UNAVAILABLE", "Mock webhook secret not configured", 503);
    }

    if (!verifyHmacSha256Hex(secret, rawBody, signature)) {
      throw new AppError("AUTH_FORBIDDEN", "Invalid webhook signature", 403);
    }

    let parsed: MockWebhookBody;
    try {
      parsed = mockWebhookBodySchema.parse(JSON.parse(rawBody.toString("utf8")));
    } catch {
      throw new AppError("VALIDATION_ERROR", "Invalid webhook payload", 400);
    }

    return this.applyProviderDecision({
      provider: "MOCK",
      providerEventId: parsed.id,
      providerSessionRef: parsed.verification.id,
      decisionStatus: mapMockStatusToSessionStatus(parsed.verification.status),
      decisionAt: parsed.verification.decisionTime
        ? new Date(parsed.verification.decisionTime)
        : new Date(),
    });
  }

  private async applyProviderDecision(input: {
    provider: VerificationProvider;
    providerEventId: string;
    providerSessionRef: string;
    decisionStatus: VerificationSessionStatus;
    decisionAt: Date;
  }) {
    return this.db.$transaction(async (tx) => {
      const existingReceipt = await tx.verificationWebhookReceipt.findUnique({
        where: {
          provider_providerEventId: {
            provider: input.provider,
            providerEventId: input.providerEventId,
          },
        },
      });
      if (existingReceipt) {
        return { duplicate: true as const };
      }

      const session = await tx.verificationSession.findUnique({
        where: {
          provider_providerSessionRef: {
            provider: input.provider,
            providerSessionRef: input.providerSessionRef,
          },
        },
        include: { user: true },
      });

      if (!session) {
        await tx.verificationWebhookReceipt.create({
          data: {
            id: randomUUID(),
            provider: input.provider,
            providerEventId: input.providerEventId,
            sessionId: null,
          },
        });
        throw new AppError("NOT_FOUND", "Verification session not found for webhook", 404);
      }

      const nextSequence = session.authoritySequence + BigInt(1);
      const incomingRank = sessionStatusRank(input.decisionStatus);
      const currentRank = sessionStatusRank(session.status);

      const revokesProviderApproval =
        input.decisionStatus === "DECLINED" ||
        input.decisionStatus === "EXPIRED" ||
        input.decisionStatus === "ABANDONED" ||
        input.decisionStatus === "CANCELLED";

      if (incomingRank < currentRank && session.completedAt && !revokesProviderApproval) {
        await tx.verificationWebhookReceipt.create({
          data: {
            id: randomUUID(),
            provider: input.provider,
            providerEventId: input.providerEventId,
            sessionId: session.id,
          },
        });
        return { duplicate: false as const, ignored: true as const };
      }

      await tx.verificationDecision.create({
        data: {
          id: randomUUID(),
          sessionId: session.id,
          providerEventId: input.providerEventId,
          decisionStatus: input.decisionStatus,
          decisionAt: input.decisionAt,
          authoritySequence: nextSequence,
        },
      });

      await tx.verificationWebhookReceipt.create({
        data: {
          id: randomUUID(),
          provider: input.provider,
          providerEventId: input.providerEventId,
          sessionId: session.id,
        },
      });

      const terminal = ["APPROVED", "DECLINED", "EXPIRED", "ABANDONED", "CANCELLED"].includes(
        input.decisionStatus,
      );

      await tx.verificationSession.update({
        where: { id: session.id },
        data: {
          status: input.decisionStatus,
          authoritySequence: nextSequence,
          completedAt: terminal ? input.decisionAt : session.completedAt,
          providerAttemptRef: input.providerEventId,
        },
      });

      const mappedUserStatus = mapProviderDecisionToUserStatus(input.decisionStatus);
      if (mappedUserStatus) {
        const userUpdate: {
          identityVerificationStatus: typeof mappedUserStatus;
          identityVerificationApprovedAt?: Date | null;
          identityVerificationValidUntil?: Date | null;
          identityVerificationRevokedAt?: Date | null;
          identityVerificationSessionId?: string | null;
          adminReviewStatus?: "NOT_READY" | "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO";
          adminReviewVerificationSessionId?: string | null;
          adminReviewDecidedAt?: Date | null;
        } = {
          identityVerificationStatus: mappedUserStatus,
        };

        if (mappedUserStatus === "APPROVED") {
          userUpdate.identityVerificationApprovedAt = input.decisionAt;
          userUpdate.identityVerificationRevokedAt = null;
          userUpdate.identityVerificationSessionId = session.id;
          userUpdate.adminReviewStatus = "PENDING";
          userUpdate.adminReviewVerificationSessionId = session.id;
          userUpdate.adminReviewDecidedAt = null;
        } else if (mappedUserStatus === "EXPIRED" || mappedUserStatus === "REJECTED") {
          userUpdate.identityVerificationApprovedAt = null;
          userUpdate.identityVerificationValidUntil = null;
          userUpdate.identityVerificationSessionId = null;
          userUpdate.adminReviewStatus = "NOT_READY";
          userUpdate.adminReviewVerificationSessionId = null;
          userUpdate.adminReviewDecidedAt = null;
        } else if (input.decisionStatus === "DECLINED") {
          userUpdate.adminReviewStatus = "NOT_READY";
          userUpdate.adminReviewVerificationSessionId = null;
          userUpdate.adminReviewDecidedAt = null;
        } else if (mappedUserStatus === "PENDING") {
          userUpdate.adminReviewStatus = "NOT_READY";
          userUpdate.adminReviewVerificationSessionId = null;
          userUpdate.adminReviewDecidedAt = null;
        }

        if (input.decisionStatus === "EXPIRED") {
          userUpdate.identityVerificationValidUntil = input.decisionAt;
        }

        await tx.user.update({
          where: { id: session.userId },
          data: userUpdate,
        });
      }

      return { duplicate: false as const, ignored: false as const, sessionId: session.id };
    });
  }
}
