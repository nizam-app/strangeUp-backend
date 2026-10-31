import type { ActivityStatus } from "../../../generated/prisma/client.js";
import { isAdminCancellableActivityStatus } from "../activities/activity-cancellation.js";

export type ActivityCancellationBlockedReason =
  "NOT_SUPER_ADMIN" | "HOST_OWN_ACTIVITY" | "ALREADY_CANCELLED" | "COMPLETED" | "INELIGIBLE";

export type ActivityCancellationCapabilities = {
  actorIsSuperAdmin: boolean;
  canCancel: boolean;
  blockedReason: ActivityCancellationBlockedReason | null;
  notificationsSupported: false;
  refundsSupported: false;
  participantRecordsPreserved: true;
};

export type ActivityCancellationTargetSnapshot = {
  activityId: string;
  hostId: string;
  status: ActivityStatus;
};

export function resolveActivityCancellationCapabilities(input: {
  actorUserId: string;
  actorIsSuperAdmin: boolean;
  target: ActivityCancellationTargetSnapshot;
}): ActivityCancellationCapabilities {
  const base = {
    notificationsSupported: false as const,
    refundsSupported: false as const,
    participantRecordsPreserved: true as const,
  };

  if (!input.actorIsSuperAdmin) {
    return {
      actorIsSuperAdmin: false,
      canCancel: false,
      blockedReason: "NOT_SUPER_ADMIN",
      ...base,
    };
  }

  if (input.actorUserId === input.target.hostId) {
    return {
      actorIsSuperAdmin: true,
      canCancel: false,
      blockedReason: "HOST_OWN_ACTIVITY",
      ...base,
    };
  }

  if (input.target.status === "CANCELLED") {
    return {
      actorIsSuperAdmin: true,
      canCancel: false,
      blockedReason: "ALREADY_CANCELLED",
      ...base,
    };
  }

  if (input.target.status === "COMPLETED") {
    return {
      actorIsSuperAdmin: true,
      canCancel: false,
      blockedReason: "COMPLETED",
      ...base,
    };
  }

  if (!isAdminCancellableActivityStatus(input.target.status)) {
    return {
      actorIsSuperAdmin: true,
      canCancel: false,
      blockedReason: "INELIGIBLE",
      ...base,
    };
  }

  return {
    actorIsSuperAdmin: true,
    canCancel: true,
    blockedReason: null,
    ...base,
  };
}
