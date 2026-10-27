import { describe, expect, it } from "vitest";
import {
  canBrowseDiscovery,
  canViewPublicProfile,
  canViewTargetVisibility,
  hasTrustedGovernmentIdKycApproved,
  isEligiblePublicProfileTarget,
} from "../src/modules/policy/public-profile-policy.js";

const eligible = {
  userId: "11111111-1111-4111-8111-111111111111",
  accountStatus: "ACTIVE" as const,
  emailVerifiedAt: new Date(),
  ageEligibilityStatus: "ELIGIBLE" as const,
  suspendedAt: null,
  deletedAt: null,
  identityVerificationStatus: "NOT_STARTED" as const,
};

const kycApproved = { ...eligible, identityVerificationStatus: "APPROVED" as const };

describe("public profile policy (D-03/D-04)", () => {
  it("requires full account access to browse", () => {
    expect(
      canBrowseDiscovery({
        userId: eligible.userId,
        accountStatus: "PENDING_VERIFICATION",
        emailVerifiedAt: null,
        ageEligibilityStatus: "ELIGIBLE",
        suspendedAt: null,
        deletedAt: null,
      }),
    ).toBe(false);
    expect(
      canBrowseDiscovery({
        userId: eligible.userId,
        accountStatus: "ACTIVE",
        emailVerifiedAt: new Date(),
        ageEligibilityStatus: "ELIGIBLE",
        suspendedAt: null,
        deletedAt: null,
      }),
    ).toBe(true);
  });

  it("treats ONLY identityVerificationStatus APPROVED as trusted KYC", () => {
    expect(hasTrustedGovernmentIdKycApproved(kycApproved)).toBe(true);
    expect(
      hasTrustedGovernmentIdKycApproved({ ...eligible, identityVerificationStatus: "PENDING" }),
    ).toBe(false);
  });

  it("allows EVERYONE visibility to email-verified eligible viewer", () => {
    expect(canViewTargetVisibility(eligible, "EVERYONE")).toBe(true);
    expect(canViewTargetVisibility(eligible, "VERIFIED_USERS_ONLY")).toBe(false);
    expect(canViewTargetVisibility(kycApproved, "VERIFIED_USERS_ONLY")).toBe(true);
  });

  it("denies blocked relationships and ineligible targets", () => {
    expect(canViewPublicProfile(eligible, eligible, "EVERYONE", true)).toBe(false);
    expect(
      canViewPublicProfile(
        eligible,
        { ...eligible, userId: "22222222-2222-4222-8222-222222222222", accountStatus: "SUSPENDED" },
        "EVERYONE",
        false,
      ),
    ).toBe(false);
    expect(
      canViewPublicProfile(
        eligible,
        { ...eligible, userId: "22222222-2222-4222-8222-222222222222" },
        "VERIFIED_USERS_ONLY",
        false,
      ),
    ).toBe(false);
    expect(
      canViewPublicProfile(
        kycApproved,
        { ...eligible, userId: "22222222-2222-4222-8222-222222222222" },
        "VERIFIED_USERS_ONLY",
        false,
      ),
    ).toBe(true);
  });

  it("requires active verified eligible target", () => {
    expect(isEligiblePublicProfileTarget(eligible)).toBe(true);
    expect(
      isEligiblePublicProfileTarget({
        ...eligible,
        accountStatus: "PENDING_VERIFICATION",
        emailVerifiedAt: null,
      }),
    ).toBe(false);
  });
});
