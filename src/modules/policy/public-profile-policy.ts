import type {
  AccountStatus,
  AgeEligibilityStatus,
  IdentityVerificationStatus,
  ProfileVisibility,
} from "../../../generated/prisma/client.js";
import type { PolicyActor } from "./account-policy.js";
import { hasFullAccountAccess } from "./account-policy.js";

export type DiscoverUserSnapshot = {
  userId: string;
  accountStatus: AccountStatus;
  emailVerifiedAt: Date | null;
  ageEligibilityStatus: AgeEligibilityStatus;
  suspendedAt: Date | null;
  deletedAt: Date | null;
  identityVerificationStatus: IdentityVerificationStatus;
};

export function hasTrustedGovernmentIdKycApproved(user: DiscoverUserSnapshot): boolean {
  return user.identityVerificationStatus === "APPROVED";
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
): boolean {
  if (targetVisibility === "EVERYONE") {
    return true;
  }
  return hasTrustedGovernmentIdKycApproved(viewer);
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
): boolean {
  const viewerActor: PolicyActor = {
    userId: viewer.userId,
    accountStatus: viewer.accountStatus,
    emailVerifiedAt: viewer.emailVerifiedAt,
    ageEligibilityStatus: viewer.ageEligibilityStatus,
    suspendedAt: viewer.suspendedAt,
    deletedAt: viewer.deletedAt,
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

  return canViewTargetVisibility(viewer, targetVisibility);
}

export function toDiscoverUserSnapshot(user: {
  id: string;
  accountStatus: AccountStatus;
  emailVerifiedAt: Date | null;
  ageEligibilityStatus: AgeEligibilityStatus;
  suspendedAt: Date | null;
  deletedAt: Date | null;
  identityVerificationStatus: IdentityVerificationStatus;
}): DiscoverUserSnapshot {
  return {
    userId: user.id,
    accountStatus: user.accountStatus,
    emailVerifiedAt: user.emailVerifiedAt,
    ageEligibilityStatus: user.ageEligibilityStatus,
    suspendedAt: user.suspendedAt,
    deletedAt: user.deletedAt,
    identityVerificationStatus: user.identityVerificationStatus,
  };
}
