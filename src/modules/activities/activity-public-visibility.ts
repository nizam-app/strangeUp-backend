import type { ActivityKycEnforcementContext } from "./activity-kyc.js";
import { activityNotFound } from "./activity-errors.js";
import { isDiscoverableActivityHost } from "./activity-host-eligibility.js";
import type { ActivityWithRelations } from "./activity-mapper.js";
import { isDiscoverableStatus } from "./activity-policy.js";

/** Published public activity row fields required for non-host discoverability checks (Task 025C / 027C). */
export type PublicActivityDiscoverabilityRow = Pick<
  ActivityWithRelations,
  "status" | "audience" | "host"
>;

/**
 * Whether a non-host may treat the activity as publicly discoverable (list/detail/cover/meeting/new RSVP).
 * Does not evaluate blocks — callers combine with block policy separately.
 */
export function isPublicActivityDiscoverableToNonHostViewer(
  row: PublicActivityDiscoverabilityRow,
  kyc: ActivityKycEnforcementContext,
  now: Date = new Date(),
): boolean {
  if (!isDiscoverableStatus(row.status) || row.audience !== "PUBLIC") {
    return false;
  }
  return isDiscoverableActivityHost(row.host, kyc, now);
}

export function assertPublicActivityDiscoverableToNonHostViewer(
  row: PublicActivityDiscoverabilityRow,
  kyc: ActivityKycEnforcementContext,
  now: Date = new Date(),
): void {
  if (!isPublicActivityDiscoverableToNonHostViewer(row, kyc, now)) {
    throw activityNotFound();
  }
}
