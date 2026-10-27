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
};

describe("buildDiscoverableUsersWhere", () => {
  it("excludes self and limits visibility to EVERYONE without KYC", () => {
    const where = buildDiscoverableUsersWhere(viewer, {});
    expect(where.id).toEqual({ not: viewer.userId });
    expect(where.profile).toBeDefined();
  });

  it("includes VERIFIED_USERS_ONLY when viewer has KYC APPROVED", () => {
    const where = buildDiscoverableUsersWhere(
      { ...viewer, identityVerificationStatus: "APPROVED" },
      {},
    );
    expect(where.profile).toBeDefined();
  });
});
