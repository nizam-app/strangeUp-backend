import type { User } from "../../../generated/prisma/client.js";
import type { PolicyActor } from "../policy/account-policy.js";
import { canStartVerification as canStartVerificationFromAccountPolicy } from "../policy/account-policy.js";

export function canStartVerification(actor: PolicyActor, user: User): boolean {
  if (user.accountStatus === "SUSPENDED" || user.accountStatus === "DELETED") {
    return false;
  }
  return canStartVerificationFromAccountPolicy(actor, user.id);
}

export function isTerminalUserKyc(user: Pick<User, "identityVerificationStatus">): boolean {
  return user.identityVerificationStatus === "APPROVED";
}
