import type { Prisma } from "../../../generated/prisma/client.js";
import type { DiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import {
  isDiscoverablePublicProfileTarget,
  type PublicKycContext,
} from "../policy/public-profile-policy.js";

/** Prisma pre-filter aligned with Task 022 activation (session match verified in policy pass). */
export function buildActivatedDiscoverTargetWhere(now: Date = new Date()): Prisma.UserWhereInput {
  return {
    identityVerificationStatus: "APPROVED",
    identityVerificationRevokedAt: null,
    adminReviewStatus: "APPROVED",
    identityVerificationSessionId: { not: null },
    adminReviewVerificationSessionId: { not: null },
    OR: [{ identityVerificationValidUntil: null }, { identityVerificationValidUntil: { gt: now } }],
  };
}

export function isRowDiscoverableTarget(
  row: DiscoverUserSnapshot,
  ctx: PublicKycContext,
  now: Date = new Date(),
): boolean {
  return isDiscoverablePublicProfileTarget(row, ctx, now);
}
