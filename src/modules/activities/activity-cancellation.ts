import type { ActivityStatus } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";

export const ACTIVITY_ADMIN_CANCELLABLE_STATUSES = ["DRAFT", "PUBLISHED"] as const;

export const ACTIVITY_PARTICIPATION_STATES_CLOSED_ON_CANCEL = [
  "CONFIRMED",
  "WAITLISTED",
  "PENDING",
] as const;

export type ActivityCancellationTx = {
  $executeRaw: DatabaseClient["$executeRaw"];
  activity: Pick<DatabaseClient["activity"], "update">;
  activityParticipation: Pick<DatabaseClient["activityParticipation"], "updateMany">;
};

/** Host and admin cancel share this record update. Rows are kept; states close. */
export async function applyActivityCancellationRecords(
  tx: ActivityCancellationTx,
  input: { activityId: string; now: Date },
): Promise<void> {
  await tx.$executeRaw`SELECT 1 FROM "Activity" WHERE "id" = ${input.activityId} FOR UPDATE`;
  await tx.activity.update({
    where: { id: input.activityId },
    data: { status: "CANCELLED", cancelledAt: input.now },
  });
  await tx.activityParticipation.updateMany({
    where: {
      activityId: input.activityId,
      state: { in: [...ACTIVITY_PARTICIPATION_STATES_CLOSED_ON_CANCEL] },
    },
    data: { state: "CANCELLED", waitlistPosition: null, cancelledAt: input.now },
  });
}

export function isAdminCancellableActivityStatus(
  status: ActivityStatus,
): status is (typeof ACTIVITY_ADMIN_CANCELLABLE_STATUSES)[number] {
  return status === "DRAFT" || status === "PUBLISHED";
}
