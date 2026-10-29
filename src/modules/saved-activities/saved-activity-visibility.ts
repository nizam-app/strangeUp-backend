import type { ActivityKycEnforcementContext } from "../activities/activity-kyc.js";
import { isPublicActivityDiscoverableToNonHostViewer } from "../activities/activity-public-visibility.js";
import type { ActivityWithRelations } from "../activities/activity-mapper.js";
import { isDiscoverableStatus } from "../activities/activity-policy.js";

/** Whether a saved activity row may appear in list/save responses (Task 025C / 027C / 027D). */
export function isSavedActivityVisibleToViewer(
  row: Pick<ActivityWithRelations, "status" | "audience" | "cancelledAt" | "host">,
  blockedEitherDirection: boolean,
  kyc: ActivityKycEnforcementContext,
  now: Date = new Date(),
): boolean {
  if (!isDiscoverableStatus(row.status) || row.audience !== "PUBLIC" || row.cancelledAt) {
    return false;
  }
  if (blockedEitherDirection) {
    return false;
  }
  return isPublicActivityDiscoverableToNonHostViewer(row, kyc, now);
}
