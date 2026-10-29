import { describe, expect, it } from "vitest";
import { buildActivatedDiscoverTargetWhere } from "../src/modules/discovery/discover-target-policy.js";
import {
  isDiscoverablePublicProfileTarget,
  isEligiblePublicProfileTarget,
} from "../src/modules/policy/public-profile-policy.js";
import { mainAppActivatedActor } from "./helpers/activation-fixtures.js";

const emailOnlyTarget = {
  userId: "22222222-2222-4222-8222-222222222222",
  accountStatus: "ACTIVE" as const,
  emailVerifiedAt: new Date(),
  ageEligibilityStatus: "ELIGIBLE" as const,
  suspendedAt: null,
  deletedAt: null,
  identityVerificationStatus: "NOT_STARTED" as const,
  identityVerificationApprovedAt: null,
  identityVerificationValidUntil: null,
  identityVerificationRevokedAt: null,
  identityVerificationSessionId: null,
  adminReviewStatus: "NOT_READY" as const,
  adminReviewVerificationSessionId: null,
};

describe("discover target activation (Task 025B)", () => {
  it("treats email-only users as base-eligible but not discoverable targets", () => {
    expect(isEligiblePublicProfileTarget(emailOnlyTarget)).toBe(true);
    expect(isDiscoverablePublicProfileTarget(emailOnlyTarget)).toBe(false);
  });

  it("allows main-app activated users as discoverable targets", () => {
    const activated = mainAppActivatedActor();
    const target = {
      userId: activated.userId,
      accountStatus: activated.accountStatus,
      emailVerifiedAt: activated.emailVerifiedAt,
      ageEligibilityStatus: activated.ageEligibilityStatus,
      suspendedAt: activated.suspendedAt,
      deletedAt: activated.deletedAt,
      identityVerificationStatus: activated.identityVerificationStatus,
      identityVerificationApprovedAt: activated.identityVerificationApprovedAt,
      identityVerificationValidUntil: activated.identityVerificationValidUntil,
      identityVerificationRevokedAt: activated.identityVerificationRevokedAt,
      identityVerificationSessionId: activated.identityVerificationSessionId,
      adminReviewStatus: activated.adminReviewStatus,
      adminReviewVerificationSessionId: activated.adminReviewVerificationSessionId,
    };
    expect(isDiscoverablePublicProfileTarget(target)).toBe(true);
  });

  it("buildActivatedDiscoverTargetWhere requires approved KYC and admin review", () => {
    const where = buildActivatedDiscoverTargetWhere();
    expect(where.identityVerificationStatus).toBe("APPROVED");
    expect(where.adminReviewStatus).toBe("APPROVED");
  });
});
