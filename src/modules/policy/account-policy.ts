import type {
  AccountStatus,
  AgeEligibilityStatus,
  User,
} from "../../../generated/prisma/client.js";

export type PolicyActor = {
  userId: string;
  accountStatus: AccountStatus;
  emailVerifiedAt: Date | null;
  ageEligibilityStatus: AgeEligibilityStatus;
  suspendedAt: Date | null;
  deletedAt: Date | null;
};

export function toPolicyActor(user: User): PolicyActor {
  return {
    userId: user.id,
    accountStatus: user.accountStatus,
    emailVerifiedAt: user.emailVerifiedAt,
    ageEligibilityStatus: user.ageEligibilityStatus,
    suspendedAt: user.suspendedAt,
    deletedAt: user.deletedAt,
  };
}

function isAccountTerminalBlocked(actor: PolicyActor): boolean {
  return (
    actor.deletedAt !== null ||
    actor.suspendedAt !== null ||
    actor.accountStatus === "DELETED" ||
    actor.accountStatus === "SUSPENDED"
  );
}

/** Own account read access (restricted states may still read subset via future /me routes). */
export function canAccessAccount(actor: PolicyActor | null, userId: string): boolean {
  if (!actor || actor.userId !== userId) {
    return false;
  }
  if (isAccountTerminalBlocked(actor)) {
    return false;
  }
  return actor.accountStatus === "ACTIVE" || actor.accountStatus === "PENDING_VERIFICATION";
}

/** Authenticated password change (settings/security); same eligibility as own account read. */
export function canChangePassword(actor: PolicyActor | null, userId: string): boolean {
  return canAccessAccount(actor, userId);
}

export function canEditProfile(actor: PolicyActor | null, userId: string): boolean {
  if (!canAccessAccount(actor, userId)) {
    return false;
  }
  if (actor!.accountStatus === "SUSPENDED" || actor!.suspendedAt !== null) {
    return false;
  }
  return actor!.emailVerifiedAt !== null && actor!.ageEligibilityStatus === "ELIGIBLE";
}

export function canStartVerification(actor: PolicyActor | null, userId: string): boolean {
  if (!canAccessAccount(actor, userId)) {
    return false;
  }
  return actor!.emailVerifiedAt !== null && actor!.ageEligibilityStatus === "ELIGIBLE";
}

export function canAccessOwnVerificationStatus(actor: PolicyActor | null, userId: string): boolean {
  return actor !== null && actor.userId === userId && !isAccountTerminalBlocked(actor);
}

/**
 * Generic cross-user interact stub (no visibility/block context).
 * Follow/Wave/DM use `canInitiateSocialContact` in `social-policy.ts`.
 */
export function canInteractWithUser(_actor: PolicyActor | null, _targetUserId: string): boolean {
  return false;
}

export function hasFullAccountAccess(actor: PolicyActor): boolean {
  return (
    actor.accountStatus === "ACTIVE" &&
    actor.emailVerifiedAt !== null &&
    actor.ageEligibilityStatus === "ELIGIBLE" &&
    !isAccountTerminalBlocked(actor)
  );
}
