import type { IdentityVerificationStatus } from "../../../generated/prisma/client.js";

export type KycEnforcementContext = {
  isProduction: boolean;
  kycProviderEnabled: boolean;
  kycManualReviewEnabled: boolean;
};

/** Fields required to evaluate current trusted KYC (KYC-03 / KYC-ENF-04). */
export type KycTrustSnapshot = {
  identityVerificationStatus: IdentityVerificationStatus;
  identityVerificationApprovedAt: Date | null;
  identityVerificationValidUntil: Date | null;
  identityVerificationRevokedAt: Date | null;
};

export const KYC_TRUST_USER_SELECT = {
  identityVerificationStatus: true,
  identityVerificationApprovedAt: true,
  identityVerificationValidUntil: true,
  identityVerificationRevokedAt: true,
} as const;

export function toKycTrustSnapshot(user: KycTrustSnapshot): KycTrustSnapshot {
  return user;
}

/**
 * Trusted government-ID KYC for enforcement gates.
 * Production fails closed until provider-backed path is enabled.
 * Email verification is never treated as KYC.
 */
export function hasTrustedKycForEnforcement(
  snapshot: KycTrustSnapshot,
  ctx: KycEnforcementContext,
  now: Date = new Date(),
): boolean {
  if (ctx.isProduction && !ctx.kycProviderEnabled && !ctx.kycManualReviewEnabled) {
    return false;
  }
  if (snapshot.identityVerificationRevokedAt) {
    return false;
  }
  if (snapshot.identityVerificationStatus !== "APPROVED") {
    return false;
  }
  if (
    snapshot.identityVerificationValidUntil &&
    snapshot.identityVerificationValidUntil.getTime() <= now.getTime()
  ) {
    return false;
  }
  return true;
}

/** Public badge / VERIFIED_USERS_ONLY visibility — same trust bar as enforcement. */
export function hasTrustedGovernmentIdKycApproved(
  snapshot: KycTrustSnapshot,
  ctx: KycEnforcementContext,
  now?: Date,
): boolean {
  return hasTrustedKycForEnforcement(snapshot, ctx, now);
}

export function mapProviderDecisionToUserStatus(
  sessionStatus: string,
): IdentityVerificationStatus | null {
  switch (sessionStatus) {
    case "APPROVED":
      return "APPROVED";
    case "DECLINED":
      return "REJECTED";
    case "EXPIRED":
      return "EXPIRED";
    case "RESUBMISSION_REQUESTED":
    case "PENDING_USER":
    case "PENDING_PROVIDER":
    case "IN_REVIEW":
      return "PENDING";
    case "ABANDONED":
    case "CANCELLED":
      return "NOT_STARTED";
    default:
      return null;
  }
}
