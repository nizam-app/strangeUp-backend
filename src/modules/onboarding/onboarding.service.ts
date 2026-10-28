import type { User, VerificationSessionStatus } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { canAccessAccount, toPolicyActor } from "../policy/account-policy.js";
import {
  computeEffectiveApplicationAccess,
  hasHomeAccess,
  resolveEmailVerificationStatus,
  resolveOnboardingNextAction,
  resolveOnboardingPhase,
  toActivationPolicyActor,
} from "../policy/effective-access-policy.js";
import { canStartVerificationSession, resolveVerificationRuntimeConfig } from "../verification/verification-config.js";
import { canStartVerification as canStartIdv, isTerminalUserKyc } from "../verification/verification-policy.js";

export class OnboardingService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly env: AppEnv,
  ) {}

  async getStatus(user: User) {
    const actor = toPolicyActor(user);
    if (!canAccessAccount(actor, user.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    const verificationConfig = resolveVerificationRuntimeConfig(this.env);
    const kycCtx = {
      isProduction: this.env.NODE_ENV === "production",
      kycProviderEnabled: verificationConfig.providerEnabled,
    };

    const latest = await this.db.verificationSession.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    });

    const canStart =
      canStartVerificationSession(verificationConfig) &&
      canStartIdv(actor, user) &&
      !isTerminalUserKyc(user);

    const canRetry =
      user.identityVerificationStatus === "REJECTED" ||
      user.identityVerificationStatus === "EXPIRED" ||
      user.identityVerificationStatus === "REVOKED" ||
      latest?.status === "DECLINED" ||
      latest?.status === "RESUBMISSION_REQUESTED";

    const activationActor = toActivationPolicyActor(user);
    const effectiveAccess = computeEffectiveApplicationAccess({
      actor: activationActor,
      kycCtx,
      latestSessionStatus: latest?.status ?? null,
    });

    const emailVerificationStatus = resolveEmailVerificationStatus(user.emailVerifiedAt);
    const homeAccessAllowed = hasHomeAccess(activationActor, kycCtx);
    const onboardingPhase = resolveOnboardingPhase({
      actor: activationActor,
      effectiveAccess,
      latestSessionStatus: latest?.status ?? null,
      canRetryVerification: canRetry,
      emailVerificationStatus,
      kycCtx,
    });

    const nextAction = resolveOnboardingNextAction({
      actor: activationActor,
      effectiveAccess,
      canStartVerification: canStart,
      canRetryVerification: canRetry,
      emailVerificationStatus,
    });

    const limitations: string[] = [];
    if (!homeAccessAllowed) {
      limitations.push("MAIN_APP_ACCESS_DENIED");
    }
    if (emailVerificationStatus === "UNVERIFIED") {
      limitations.push("EMAIL_VERIFICATION_REQUIRED");
    }
    if (!canStart && verificationConfig.runtimeStatus === "FEATURE_DISABLED") {
      limitations.push("IDENTITY_PROVIDER_DISABLED");
    }

    return {
      accountStatus: user.accountStatus,
      emailVerificationStatus,
      ageEligibilityStatus: user.ageEligibilityStatus,
      identityVerificationStatus: user.identityVerificationStatus,
      adminReviewStatus: user.adminReviewStatus,
      onboardingPhase,
      effectiveApplicationAccess: effectiveAccess,
      homeAccessAllowed,
      nextAction,
      canStartVerification: canStart,
      canRetry: canRetry && canStartVerificationSession(verificationConfig),
      limitations,
      updatedAt: user.updatedAt.toISOString(),
      verificationStepHint: mapVerificationStepHint(latest?.status ?? null, user.identityVerificationStatus),
    };
  }
}

function mapVerificationStepHint(
  sessionStatus: VerificationSessionStatus | null,
  identityStatus: User["identityVerificationStatus"],
): "PERSONAL_INFO" | "GOVERNMENT_ID" | "SELFIE" | "PROVIDER_REVIEW" | "ADMIN_REVIEW" | "NONE" {
  if (identityStatus === "APPROVED") {
    return "ADMIN_REVIEW";
  }
  if (sessionStatus === "IN_REVIEW" || sessionStatus === "PENDING_PROVIDER") {
    return "PROVIDER_REVIEW";
  }
  if (sessionStatus === "PENDING_USER") {
    return "GOVERNMENT_ID";
  }
  if (identityStatus === "NOT_STARTED") {
    return "PERSONAL_INFO";
  }
  if (identityStatus === "PENDING") {
    return "SELFIE";
  }
  return "NONE";
}
