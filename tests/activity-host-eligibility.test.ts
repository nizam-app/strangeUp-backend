import { describe, expect, it } from "vitest";
import { isDiscoverableActivityHost } from "../src/modules/activities/activity-host-eligibility.js";
import { mainAppActivatedActor } from "./helpers/activation-fixtures.js";

describe("activity host eligibility (Task 025C)", () => {
  it("requires main-app activation for published activity hosts", () => {
    const activated = mainAppActivatedActor();
    expect(
      isDiscoverableActivityHost(
        {
          id: activated.userId,
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
        },
        { isProduction: false, kycProviderEnabled: false },
      ),
    ).toBe(true);

    expect(
      isDiscoverableActivityHost(
        {
          id: activated.userId,
          accountStatus: activated.accountStatus,
          emailVerifiedAt: activated.emailVerifiedAt,
          ageEligibilityStatus: activated.ageEligibilityStatus,
          suspendedAt: activated.suspendedAt,
          deletedAt: activated.deletedAt,
          identityVerificationStatus: "NOT_STARTED",
          identityVerificationApprovedAt: null,
          identityVerificationValidUntil: null,
          identityVerificationRevokedAt: null,
          identityVerificationSessionId: null,
          adminReviewStatus: "NOT_READY",
          adminReviewVerificationSessionId: null,
        },
        { isProduction: false, kycProviderEnabled: false },
      ),
    ).toBe(false);
  });
});
