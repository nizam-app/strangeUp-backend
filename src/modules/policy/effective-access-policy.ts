import type {
  AccountStatus,
  AgeEligibilityStatus,
  IdentityVerificationStatus,
  StrangeUpAdminReviewStatus,
  User,
} from "../../../generated/prisma/client.js";
import {
  hasTrustedKycForEnforcement,
  type KycEnforcementContext,
  type KycTrustSnapshot,
} from "../verification/kyc-trust.js";
/** Default context for unit tests and non-production policy evaluation. */
export const DEFAULT_KYC_ENFORCEMENT_CONTEXT: KycEnforcementContext = {
  isProduction: false,
  kycProviderEnabled: false,
};

export type ActivationPolicyActor = {
  userId: string;
  accountStatus: AccountStatus;
  emailVerifiedAt: Date | null;
  ageEligibilityStatus: AgeEligibilityStatus;
  suspendedAt: Date | null;
  deletedAt: Date | null;
  identityVerificationSessionId: string | null;
  adminReviewStatus: StrangeUpAdminReviewStatus;
  adminReviewVerificationSessionId: string | null;
} & KycTrustSnapshot;

export type ActivationPolicyUserInput = Pick<
  User,
  | "id"
  | "accountStatus"
  | "emailVerifiedAt"
  | "ageEligibilityStatus"
  | "suspendedAt"
  | "deletedAt"
  | "identityVerificationStatus"
  | "identityVerificationApprovedAt"
  | "identityVerificationValidUntil"
  | "identityVerificationRevokedAt"
> &
  Partial<
    Pick<
      User,
      "identityVerificationSessionId" | "adminReviewStatus" | "adminReviewVerificationSessionId"
    >
  >;

export function toActivationPolicyActor(user: ActivationPolicyUserInput): ActivationPolicyActor {
  return {
    userId: user.id,
    accountStatus: user.accountStatus,
    emailVerifiedAt: user.emailVerifiedAt,
    ageEligibilityStatus: user.ageEligibilityStatus,
    suspendedAt: user.suspendedAt,
    deletedAt: user.deletedAt,
    identityVerificationStatus: user.identityVerificationStatus,
    identityVerificationApprovedAt: user.identityVerificationApprovedAt,
    identityVerificationValidUntil: user.identityVerificationValidUntil,
    identityVerificationRevokedAt: user.identityVerificationRevokedAt,
    identityVerificationSessionId: user.identityVerificationSessionId ?? null,
    adminReviewStatus: user.adminReviewStatus ?? "NOT_READY",
    adminReviewVerificationSessionId: user.adminReviewVerificationSessionId ?? null,
  };
}

function isAccountTerminalBlocked(actor: ActivationPolicyActor): boolean {
  return (
    actor.deletedAt !== null ||
    actor.suspendedAt !== null ||
    actor.accountStatus === "DELETED" ||
    actor.accountStatus === "SUSPENDED"
  );
}

function hasBaseAccountEligibility(actor: ActivationPolicyActor): boolean {
  return (
    actor.accountStatus === "ACTIVE" &&
    actor.emailVerifiedAt !== null &&
    actor.ageEligibilityStatus === "ELIGIBLE" &&
    !isAccountTerminalBlocked(actor)
  );
}

export function isAdminReviewApprovedForCurrentIdentity(actor: ActivationPolicyActor): boolean {
  if (actor.adminReviewStatus !== "APPROVED") {
    return false;
  }
  if (!actor.adminReviewVerificationSessionId || !actor.identityVerificationSessionId) {
    return false;
  }
  return actor.adminReviewVerificationSessionId === actor.identityVerificationSessionId;
}

/**
 * Main product / Home access (AUTH-FLOW-2026-10-28).
 * Requires trusted provider identity, StrangeUp admin approval tied to the same session, and base account gates.
 */
export function hasHomeAccess(
  actor: ActivationPolicyActor,
  kycCtx: KycEnforcementContext = DEFAULT_KYC_ENFORCEMENT_CONTEXT,
  now: Date = new Date(),
): boolean {
  if (!hasBaseAccountEligibility(actor)) {
    return false;
  }
  if (!hasTrustedKycForEnforcement(actor, kycCtx, now)) {
    return false;
  }
  return isAdminReviewApprovedForCurrentIdentity(actor);
}

/** @deprecated alias — use hasHomeAccess for clarity in new code. */
export function hasFullAccountAccess(
  actor: ActivationPolicyActor,
  kycCtx?: KycEnforcementContext,
): boolean {
  return hasHomeAccess(actor, kycCtx);
}

export type EffectiveApplicationAccess =
  | "ACTIVE"
  | "ONBOARDING_REQUIRED"
  | "WAITING_FOR_VERIFICATION"
  | "WAITING_FOR_ADMIN_REVIEW"
  | "ACTION_REQUIRED"
  | "DENIED";

export type OnboardingNextAction =
  | "VERIFY_EMAIL"
  | "COMPLETE_REGISTRATION_CONSENT"
  | "START_IDENTITY_VERIFICATION"
  | "CONTINUE_IDENTITY_VERIFICATION"
  | "WAIT_FOR_PROVIDER_DECISION"
  | "WAIT_FOR_ADMIN_REVIEW"
  | "ADMIN_REJECTED"
  | "CONTACT_SUPPORT"
  | "RETRY_IDENTITY_VERIFICATION"
  | "ACCOUNT_SUSPENDED"
  | "HOME_READY";

export type OnboardingPhase =
  | "AWAITING_EMAIL_VERIFICATION"
  | "READY_FOR_IDENTITY_VERIFICATION"
  | "IDENTITY_VERIFICATION_IN_PROGRESS"
  | "IDENTITY_RESUBMISSION_REQUIRED"
  | "AWAITING_PROVIDER_DECISION"
  | "PROVIDER_DECLINED_OR_EXPIRED"
  | "AWAITING_ADMIN_REVIEW"
  | "ADMIN_REJECTED"
  | "FULLY_ACTIVATED";

export type EmailVerificationStatus = "UNVERIFIED" | "VERIFIED";

export function resolveEmailVerificationStatus(
  emailVerifiedAt: Date | null,
): EmailVerificationStatus {
  return emailVerifiedAt ? "VERIFIED" : "UNVERIFIED";
}

export function computeEffectiveApplicationAccess(input: {
  actor: ActivationPolicyActor;
  kycCtx?: KycEnforcementContext;
  latestSessionStatus?: string | null;
}): EffectiveApplicationAccess {
  const { actor } = input;
  const kycCtx = input.kycCtx ?? DEFAULT_KYC_ENFORCEMENT_CONTEXT;

  if (
    actor.accountStatus === "DELETED" ||
    actor.deletedAt !== null ||
    actor.accountStatus === "SUSPENDED" ||
    actor.suspendedAt !== null
  ) {
    return "DENIED";
  }

  if (actor.ageEligibilityStatus === "INELIGIBLE") {
    return "DENIED";
  }

  if (hasHomeAccess(actor, kycCtx)) {
    return "ACTIVE";
  }

  if (!actor.emailVerifiedAt || actor.ageEligibilityStatus !== "ELIGIBLE") {
    return "ONBOARDING_REQUIRED";
  }

  if (actor.adminReviewStatus === "REJECTED") {
    return "DENIED";
  }

  if (
    actor.identityVerificationStatus === "REJECTED" ||
    actor.identityVerificationStatus === "EXPIRED" ||
    actor.identityVerificationStatus === "REVOKED"
  ) {
    return "ACTION_REQUIRED";
  }

  if (
    hasTrustedKycForEnforcement(actor, kycCtx) &&
    (actor.adminReviewStatus === "PENDING" ||
      actor.adminReviewStatus === "NEEDS_MORE_INFO" ||
      actor.adminReviewStatus === "NOT_READY")
  ) {
    return "WAITING_FOR_ADMIN_REVIEW";
  }

  if (
    actor.identityVerificationStatus === "PENDING" ||
    actor.identityVerificationStatus === "NOT_STARTED" ||
    input.latestSessionStatus === "PENDING_USER" ||
    input.latestSessionStatus === "PENDING_PROVIDER" ||
    input.latestSessionStatus === "IN_REVIEW" ||
    input.latestSessionStatus === "RESUBMISSION_REQUESTED"
  ) {
    return "WAITING_FOR_VERIFICATION";
  }

  return "ONBOARDING_REQUIRED";
}

export function resolveOnboardingNextAction(input: {
  actor: ActivationPolicyActor;
  effectiveAccess: EffectiveApplicationAccess;
  canStartVerification: boolean;
  canRetryVerification: boolean;
  emailVerificationStatus: EmailVerificationStatus;
}): OnboardingNextAction {
  const { actor, effectiveAccess } = input;

  if (actor.accountStatus === "SUSPENDED" || actor.suspendedAt) {
    return "ACCOUNT_SUSPENDED";
  }

  if (effectiveAccess === "ACTIVE") {
    return "HOME_READY";
  }

  if (input.emailVerificationStatus === "UNVERIFIED") {
    return "VERIFY_EMAIL";
  }

  if (actor.ageEligibilityStatus !== "ELIGIBLE") {
    return "CONTACT_SUPPORT";
  }

  if (actor.adminReviewStatus === "REJECTED") {
    return "ADMIN_REJECTED";
  }

  if (effectiveAccess === "WAITING_FOR_ADMIN_REVIEW") {
    return "WAIT_FOR_ADMIN_REVIEW";
  }

  if (
    actor.identityVerificationStatus === "REJECTED" ||
    actor.identityVerificationStatus === "EXPIRED" ||
    actor.identityVerificationStatus === "REVOKED"
  ) {
    return input.canRetryVerification ? "RETRY_IDENTITY_VERIFICATION" : "CONTACT_SUPPORT";
  }

  if (actor.identityVerificationStatus === "PENDING") {
    return "WAIT_FOR_PROVIDER_DECISION";
  }

  if (input.canStartVerification) {
    return "START_IDENTITY_VERIFICATION";
  }

  if (effectiveAccess === "WAITING_FOR_VERIFICATION") {
    return "CONTINUE_IDENTITY_VERIFICATION";
  }

  return "CONTACT_SUPPORT";
}

export function identityVerificationStatusForApi(
  status: IdentityVerificationStatus,
): IdentityVerificationStatus {
  return status;
}

export function accountStatusForApi(status: AccountStatus): AccountStatus {
  return status;
}

export function ageEligibilityStatusForApi(status: AgeEligibilityStatus): AgeEligibilityStatus {
  return status;
}

export function resolveOnboardingPhase(input: {
  actor: ActivationPolicyActor;
  effectiveAccess: EffectiveApplicationAccess;
  latestSessionStatus?: string | null;
  canRetryVerification: boolean;
  emailVerificationStatus: EmailVerificationStatus;
  kycCtx?: KycEnforcementContext;
}): OnboardingPhase {
  const { actor, effectiveAccess } = input;
  const kycCtx = input.kycCtx ?? DEFAULT_KYC_ENFORCEMENT_CONTEXT;

  if (hasHomeAccess(actor, kycCtx)) {
    return "FULLY_ACTIVATED";
  }

  if (actor.adminReviewStatus === "REJECTED") {
    return "ADMIN_REJECTED";
  }

  if (input.emailVerificationStatus === "UNVERIFIED") {
    return "AWAITING_EMAIL_VERIFICATION";
  }

  if (
    hasTrustedKycForEnforcement(actor, kycCtx) &&
    (actor.adminReviewStatus === "PENDING" || actor.adminReviewStatus === "NEEDS_MORE_INFO")
  ) {
    return "AWAITING_ADMIN_REVIEW";
  }

  if (
    actor.identityVerificationStatus === "REJECTED" ||
    actor.identityVerificationStatus === "EXPIRED" ||
    actor.identityVerificationStatus === "REVOKED"
  ) {
    return "PROVIDER_DECLINED_OR_EXPIRED";
  }

  if (input.latestSessionStatus === "RESUBMISSION_REQUESTED" || input.canRetryVerification) {
    return "IDENTITY_RESUBMISSION_REQUIRED";
  }

  if (
    input.latestSessionStatus === "PENDING_PROVIDER" ||
    input.latestSessionStatus === "IN_REVIEW" ||
    actor.identityVerificationStatus === "PENDING"
  ) {
    return "AWAITING_PROVIDER_DECISION";
  }

  if (
    input.latestSessionStatus === "PENDING_USER" ||
    effectiveAccess === "WAITING_FOR_VERIFICATION"
  ) {
    return "IDENTITY_VERIFICATION_IN_PROGRESS";
  }

  return "READY_FOR_IDENTITY_VERIFICATION";
}
