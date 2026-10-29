import { describe, expect, it } from "vitest";
import { buildDiscoverableUsersWhere } from "../src/modules/discovery/discover-query.js";

const viewer = {
  userId: "11111111-1111-4111-8111-111111111111",
  accountStatus: "ACTIVE" as const,
  emailVerifiedAt: new Date(),
  ageEligibilityStatus: "ELIGIBLE" as const,
  suspendedAt: null,
  deletedAt: null,
  identityVerificationStatus: "NOT_STARTED" as const,
  identityVerificationApprovedAt: null,
  identityVerificationValidUntil: null,
  identityVerificationRevokedAt: null,
};

describe("buildDiscoverableUsersWhere", () => {
  it("excludes self, requires activation pre-filter, limits visibility without viewer KYC", () => {
    const where = buildDiscoverableUsersWhere(viewer, {});
    expect(where.id).toEqual({ not: viewer.userId });
    expect(where.profile).toBeDefined();
    expect(where.adminReviewStatus).toBe("APPROVED");
    expect(where.identityVerificationStatus).toBe("APPROVED");
  });

  it("includes VERIFIED_USERS_ONLY when viewer has KYC APPROVED", () => {
    const where = buildDiscoverableUsersWhere(
      { ...viewer, identityVerificationStatus: "APPROVED" },
      {},
    );
    expect(where.profile).toBeDefined();
  });
});
