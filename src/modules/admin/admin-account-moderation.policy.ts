import type { AccountStatus } from "../../../generated/prisma/client.js";

export type AccountModerationBlockedReason =
  "NOT_SUPER_ADMIN" | "SELF" | "STAFF_ACCOUNT" | "DELETED" | "ALREADY_SUSPENDED" | "NOT_SUSPENDED";

export type AccountModerationCapabilities = {
  actorIsSuperAdmin: boolean;
  canSuspend: boolean;
  canRestore: boolean;
  blockedReason: AccountModerationBlockedReason | null;
};

export type AccountModerationTargetSnapshot = {
  userId: string;
  accountStatus: AccountStatus;
  deletedAt: Date | null;
};

export function resolveAccountModerationCapabilities(input: {
  actorUserId: string;
  actorIsSuperAdmin: boolean;
  target: AccountModerationTargetSnapshot;
  targetHasActiveStaffGrant: boolean;
}): AccountModerationCapabilities {
  const { actorUserId, actorIsSuperAdmin, target, targetHasActiveStaffGrant } = input;

  if (!actorIsSuperAdmin) {
    return {
      actorIsSuperAdmin: false,
      canSuspend: false,
      canRestore: false,
      blockedReason: "NOT_SUPER_ADMIN",
    };
  }
  if (target.deletedAt !== null || target.accountStatus === "DELETED") {
    return {
      actorIsSuperAdmin: true,
      canSuspend: false,
      canRestore: false,
      blockedReason: "DELETED",
    };
  }
  if (actorUserId === target.userId) {
    return {
      actorIsSuperAdmin: true,
      canSuspend: false,
      canRestore: false,
      blockedReason: "SELF",
    };
  }
  if (targetHasActiveStaffGrant) {
    return {
      actorIsSuperAdmin: true,
      canSuspend: false,
      canRestore: false,
      blockedReason: "STAFF_ACCOUNT",
    };
  }

  const isSuspended = target.accountStatus === "SUSPENDED";
  return {
    actorIsSuperAdmin: true,
    canSuspend: !isSuspended,
    canRestore: isSuspended,
    blockedReason: isSuspended ? "ALREADY_SUSPENDED" : "NOT_SUSPENDED",
  };
}

export function isSuspendableAccountStatus(status: AccountStatus): boolean {
  return status === "ACTIVE" || status === "PENDING_VERIFICATION";
}

export function restoreAccountStatusFromPrior(
  previousAccountStatus: AccountStatus | null,
): Exclude<AccountStatus, "SUSPENDED" | "DELETED"> {
  if (previousAccountStatus === "PENDING_VERIFICATION") {
    return "PENDING_VERIFICATION";
  }
  return "ACTIVE";
}
