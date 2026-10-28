import type {
  AccountStatus,
  AgeEligibilityStatus,
  IdentityVerificationStatus,
  ProfileVisibility,
  StrangeUpAdminReviewStatus,
} from "../../../generated/prisma/client.js";
import type { PolicyActor } from "./account-policy.js";
import { hasFullAccountAccess } from "./account-policy.js";
import {
  hasTrustedKycForEnforcement,
  type KycEnforcementContext,
  type KycTrustSnapshot,
} from "../verification/kyc-trust.js";

export type DiscoverUserSnapshot = {
  userId: string;
  accountStatus: AccountStatus;
  emailVerifiedAt: Date | null;
  ageEligibilityStatus: AgeEligibilityStatus;
  suspendedAt: Date | null;
  deletedAt: Date | null;
  identityVerificationStatus: IdentityVerificationStatus;
  identityVerificationApprovedAt: Date | null;
  identityVerificationValidUntil: Date | null;
  identityVerificationRevokedAt: Date | null;
  identityVerificationSessionId?: string | null;
  adminReviewStatus?: StrangeUpAdminReviewStatus;
  adminReviewVerificationSessionId?: string | null;
};

export type PublicKycContext = KycEnforcementContext;

const DEFAULT_PUBLIC_KYC_CONTEXT: PublicKycContext = {
  isProduction: false,
  kycProviderEnabled: false,
};

function snapshotToKycTrust(user: DiscoverUserSnapshot): KycTrustSnapshot {
  return {
    identityVerificationStatus: user.identityVerificationStatus,
    identityVerificationApprovedAt: user.identityVerificationApprovedAt,
    identityVerificationValidUntil: user.identityVerificationValidUntil,
    identityVerificationRevokedAt: user.identityVerificationRevokedAt,
  };
}

export function hasTrustedGovernmentIdKycApproved(
  user: DiscoverUserSnapshot,
  ctx: PublicKycContext = DEFAULT_PUBLIC_KYC_CONTEXT,
): boolean {
  return hasTrustedKycForEnforcement(snapshotToKycTrust(user), ctx);
}

/** Eligible to appear as a discovery/public profile target (D-03/D-04). */
export function isEligiblePublicProfileTarget(user: DiscoverUserSnapshot): boolean {
  return (
    user.accountStatus === "ACTIVE" &&
    user.emailVerifiedAt !== null &&
    user.ageEligibilityStatus === "ELIGIBLE" &&
    user.suspendedAt === null &&
    user.deletedAt === null
  );
}

/** Eligible authenticated viewer for discovery and public profile reads. */
export function canBrowseDiscovery(actor: PolicyActor): boolean {
  return hasFullAccountAccess(actor);
}

export function canViewTargetVisibility(
  viewer: DiscoverUserSnapshot,
  targetVisibility: ProfileVisibility,
  ctx: PublicKycContext = DEFAULT_PUBLIC_KYC_CONTEXT,
): boolean {
  if (targetVisibility === "EVERYONE") {
    return true;
  }
  return hasTrustedGovernmentIdKycApproved(viewer, ctx);
}

/**
 * Whether `viewer` may see `target`'s public profile (list preview, detail, avatar).
 * Caller supplies bidirectional block state from persistence.
 */
export function canViewPublicProfile(
  viewer: DiscoverUserSnapshot,
  target: DiscoverUserSnapshot,
  targetVisibility: ProfileVisibility,
  blockedEitherDirection: boolean,
  ctx: PublicKycContext = DEFAULT_PUBLIC_KYC_CONTEXT,
): boolean {
  const viewerActor: PolicyActor = {
    userId: viewer.userId,
    accountStatus: viewer.accountStatus,
    emailVerifiedAt: viewer.emailVerifiedAt,
    ageEligibilityStatus: viewer.ageEligibilityStatus,
    suspendedAt: viewer.suspendedAt,
    deletedAt: viewer.deletedAt,
    identityVerificationStatus: viewer.identityVerificationStatus,
    identityVerificationApprovedAt: viewer.identityVerificationApprovedAt,
    identityVerificationValidUntil: viewer.identityVerificationValidUntil,
    identityVerificationRevokedAt: viewer.identityVerificationRevokedAt,
    identityVerificationSessionId: viewer.identityVerificationSessionId ?? null,
    adminReviewStatus: viewer.adminReviewStatus ?? "NOT_READY",
    adminReviewVerificationSessionId: viewer.adminReviewVerificationSessionId ?? null,
  };
  if (!canBrowseDiscovery(viewerActor)) {
    return false;
  }

  if (!isEligiblePublicProfileTarget(target)) {
    return false;
  }

  if (blockedEitherDirection) {
    return false;
  }

  if (viewer.userId === target.userId) {
    return true;
  }

  return canViewTargetVisibility(viewer, targetVisibility, ctx);
}

export function toDiscoverUserSnapshot(user: {
  id: string;
  accountStatus: AccountStatus;
  emailVerifiedAt: Date | null;
  ageEligibilityStatus: AgeEligibilityStatus;
  suspendedAt: Date | null;
  deletedAt: Date | null;
  identityVerificationStatus: IdentityVerificationStatus;
  identityVerificationApprovedAt?: Date | null;
  identityVerificationValidUntil?: Date | null;
  identityVerificationRevokedAt?: Date | null;
  identityVerificationSessionId?: string | null;
  adminReviewStatus?: StrangeUpAdminReviewStatus;
  adminReviewVerificationSessionId?: string | null;
}): DiscoverUserSnapshot {
  return {
    userId: user.id,
    accountStatus: user.accountStatus,
    emailVerifiedAt: user.emailVerifiedAt,
    ageEligibilityStatus: user.ageEligibilityStatus,
    suspendedAt: user.suspendedAt,
    deletedAt: user.deletedAt,
    identityVerificationStatus: user.identityVerificationStatus,
    identityVerificationApprovedAt: user.identityVerificationApprovedAt ?? null,
    identityVerificationValidUntil: user.identityVerificationValidUntil ?? null,
    identityVerificationRevokedAt: user.identityVerificationRevokedAt ?? null,
    identityVerificationSessionId: user.identityVerificationSessionId ?? null,
    adminReviewStatus: user.adminReviewStatus,
    adminReviewVerificationSessionId: user.adminReviewVerificationSessionId ?? null,
  };
}
