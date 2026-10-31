import {
  hasFullAccountAccess as hasHomeAccessFromActivation,
  toActivationPolicyActor,
  type ActivationPolicyActor,
  type ActivationPolicyUserInput,
} from "./effective-access-policy.js";
import type { KycEnforcementContext } from "../verification/kyc-trust.js";

export type PolicyActor = ActivationPolicyActor;

export function toPolicyActor(user: ActivationPolicyUserInput): PolicyActor {
  return toActivationPolicyActor(user);
}

function isAccountTerminalBlocked(actor: PolicyActor): boolean {
  return (
    actor.deletedAt !== null ||
    actor.suspendedAt !== null ||
    actor.accountStatus === "DELETED" ||
    actor.accountStatus === "SUSPENDED"
  );
}

/** Own account read access (restricted states may still read subset via /me routes). */
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
  return actor!.accountStatus === "ACTIVE" && actor!.ageEligibilityStatus === "ELIGIBLE";
}

export function canStartVerification(actor: PolicyActor | null, userId: string): boolean {
  if (!canAccessAccount(actor, userId)) {
    return false;
  }
  return actor!.accountStatus === "ACTIVE" && actor!.ageEligibilityStatus === "ELIGIBLE";
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

/** Main product / Home gate (provider KYC + StrangeUp admin approval + account eligibility). */
export function hasFullAccountAccess(actor: PolicyActor, kycCtx?: KycEnforcementContext): boolean {
  return hasHomeAccessFromActivation(actor, kycCtx);
}
