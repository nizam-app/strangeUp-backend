import type { User } from "../../../generated/prisma/client.js";
import type { ActivityKycEnforcementContext } from "./activity-kyc.js";
import {
  isDiscoverablePublicProfileTarget,
  toDiscoverUserSnapshot,
} from "../policy/public-profile-policy.js";

export type ActivityHostPolicyFields = Pick<
  User,
  | "id"
  | "accountStatus"
  | "emailVerifiedAt"
  | "ageEligibilityStatus"
  | "suspendedAt"
  | "deletedAt"
  | "identityVerificationStatus"
  | "identityVerificationApprovedAt"
  | "identityVerificationValidUntil"
  | "identityVerificationRevokedAt"
  | "identityVerificationSessionId"
  | "adminReviewStatus"
  | "adminReviewVerificationSessionId"
>;

export function isDiscoverableActivityHost(
  host: ActivityHostPolicyFields,
  kyc: ActivityKycEnforcementContext,
  now: Date = new Date(),
): boolean {
  return isDiscoverablePublicProfileTarget(toDiscoverUserSnapshot(host), kyc, now);
}
