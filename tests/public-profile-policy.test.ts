import { describe, expect, it } from "vitest";
import {
  canBrowseDiscovery,
  canViewPublicProfile,
  canViewTargetVisibility,
  hasTrustedGovernmentIdKycApproved,
  isEligiblePublicProfileTarget,
} from "../src/modules/policy/public-profile-policy.js";
import { baseEligibleActor, mainAppActivatedActor } from "./helpers/activation-fixtures.js";

const eligible = {
  userId: baseEligibleActor().userId,
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

const activatedViewer = {
  userId: mainAppActivatedActor().userId,
  accountStatus: "ACTIVE" as const,
  emailVerifiedAt: new Date(),
  ageEligibilityStatus: "ELIGIBLE" as const,
  suspendedAt: null,
  deletedAt: null,
  identityVerificationStatus: "APPROVED" as const,
  identityVerificationApprovedAt: new Date(),
  identityVerificationValidUntil: null,
  identityVerificationRevokedAt: null,
  identityVerificationSessionId: mainAppActivatedActor().identityVerificationSessionId,
  adminReviewStatus: "APPROVED" as const,
  adminReviewVerificationSessionId: mainAppActivatedActor().adminReviewVerificationSessionId,
};

const kycApproved = {
  ...eligible,
  identityVerificationStatus: "APPROVED" as const,
  identityVerificationApprovedAt: new Date(),
};

describe("public profile policy (D-03/D-04)", () => {
  it("requires full account access to browse", () => {
    expect(
      canBrowseDiscovery(
        baseEligibleActor({
          accountStatus: "PENDING_VERIFICATION",
          emailVerifiedAt: null,
        }),
      ),
    ).toBe(false);
    expect(canBrowseDiscovery(baseEligibleActor())).toBe(false);
    expect(canBrowseDiscovery(mainAppActivatedActor())).toBe(true);
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

  it("requires activated viewer to browse another user's public profile", () => {
    expect(canViewPublicProfile(eligible, eligible, "EVERYONE", false)).toBe(false);
    expect(canViewPublicProfile(activatedViewer, eligible, "EVERYONE", false)).toBe(true);
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
        activatedViewer,
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
