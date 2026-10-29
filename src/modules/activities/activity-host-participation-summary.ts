import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { ActivityHostParticipationSummaryDto } from "./activity.dto.js";

export async function loadHostParticipationSummary(
  db: DatabaseClient,
  activityId: string,
): Promise<ActivityHostParticipationSummaryDto> {
  const [pendingRequestCount, confirmedSeatCount, approvedWaitlistedCount, declinedRequestCount] =
    await Promise.all([
      db.activityParticipation.count({ where: { activityId, state: "PENDING" } }),
      db.activityParticipation.count({ where: { activityId, state: "CONFIRMED" } }),
      db.activityParticipation.count({
        where: { activityId, state: "WAITLISTED", hostApprovedAt: { not: null } },
      }),
      db.activityParticipation.count({ where: { activityId, state: "DECLINED" } }),
    ]);
  return {
    pendingRequestCount,
    confirmedSeatCount,
    approvedWaitlistedCount,
    declinedRequestCount,
  };
}
