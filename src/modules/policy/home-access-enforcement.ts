import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { AppErrorCode } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import {
  computeEffectiveApplicationAccess,
  hasHomeAccess,
  resolveOnboardingNextAction,
  resolveOnboardingPhase,
  resolveEmailVerificationStatus,
  toActivationPolicyActor,
  type EffectiveApplicationAccess,
  type OnboardingNextAction,
  type OnboardingPhase,
} from "./effective-access-policy.js";
import { buildKycEnforcementContext } from "../verification/kyc-identity-authority.js";

export type HomeAccessDenialDetails = {
  homeAccessAllowed: false;
  onboardingPhase: OnboardingPhase;
  effectiveApplicationAccess: EffectiveApplicationAccess;
  nextAction: OnboardingNextAction;
};

export class MainAppAccessError extends AppError {
  readonly denial: HomeAccessDenialDetails;

  constructor(code: AppErrorCode, message: string, denial: HomeAccessDenialDetails) {
    super(code, message, 403, { exposeMessage: true });
    this.denial = denial;
  }
}

function buildKycContext(env: AppEnv) {
  return buildKycEnforcementContext(env);
}

export async function loadFreshUser(db: DatabaseClient, userId: string): Promise<User | null> {
  return db.user.findUnique({ where: { id: userId } });
}

export function buildHomeAccessDenial(
  user: User,
  env: AppEnv,
  latestSessionStatus?: string | null,
): { code: AppErrorCode; denial: HomeAccessDenialDetails } {
  const kycCtx = buildKycContext(env);
  const actor = toActivationPolicyActor(user);
  const emailVerificationStatus = resolveEmailVerificationStatus(user.emailVerifiedAt);
  const effectiveAccess = computeEffectiveApplicationAccess({
    actor,
    kycCtx,
    latestSessionStatus: latestSessionStatus ?? null,
  });
  const onboardingPhase = resolveOnboardingPhase({
    actor,
    effectiveAccess,
    latestSessionStatus: latestSessionStatus ?? null,
    canRetryVerification: false,
    emailVerificationStatus,
    kycCtx,
  });
  const nextAction = resolveOnboardingNextAction({
    actor,
    effectiveAccess,
    canStartVerification: false,
    canRetryVerification: false,
    emailVerificationStatus,
  });

  const code: AppErrorCode =
    user.adminReviewStatus === "REJECTED" || effectiveAccess === "DENIED"
      ? "ACCOUNT_NOT_ACTIVATED"
      : "ONBOARDING_REQUIRED";

  return {
    code,
    denial: {
      homeAccessAllowed: false,
      onboardingPhase,
      effectiveApplicationAccess: effectiveAccess,
      nextAction,
    },
  };
}

export async function assertMainAppHomeAccess(
  db: DatabaseClient,
  env: AppEnv,
  userId: string,
): Promise<User> {
  const user = await loadFreshUser(db, userId);
  if (!user) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  const kycCtx = buildKycContext(env);
  const actor = toActivationPolicyActor(user);
  if (hasHomeAccess(actor, kycCtx)) {
    return user;
  }

  const latest = await db.verificationSession.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });
  const { code, denial } = buildHomeAccessDenial(user, env, latest?.status ?? null);
  const message =
    code === "ACCOUNT_NOT_ACTIVATED"
      ? "Account is not activated for main app access"
      : "Complete onboarding before accessing this feature";
  throw new MainAppAccessError(code, message, denial);
}

export function assertMainAppHomeAccessForUser(user: User, env: AppEnv): void {
  const kycCtx = buildKycContext(env);
  if (hasHomeAccess(toActivationPolicyActor(user), kycCtx)) {
    return;
  }
  const { code, denial } = buildHomeAccessDenial(user, env);
  const message =
    code === "ACCOUNT_NOT_ACTIVATED"
      ? "Account is not activated for main app access"
      : "Complete onboarding before accessing this feature";
  throw new MainAppAccessError(code, message, denial);
}
