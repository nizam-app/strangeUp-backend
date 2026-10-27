import type { User } from "../../../generated/prisma/client.js";
import type { PolicyActor } from "../policy/account-policy.js";
import { hasFullAccountAccess } from "../policy/account-policy.js";

export function canStartVerification(actor: PolicyActor, user: User): boolean {
  if (!hasFullAccountAccess(actor)) {
    return false;
  }
  if (user.accountStatus === "SUSPENDED" || user.accountStatus === "DELETED") {
    return false;
  }
  if (!user.emailVerifiedAt) {
    return false;
  }
  if (user.ageEligibilityStatus !== "ELIGIBLE") {
    return false;
  }
  return true;
}

export function isTerminalUserKyc(user: Pick<User, "identityVerificationStatus">): boolean {
  return user.identityVerificationStatus === "APPROVED";
}
