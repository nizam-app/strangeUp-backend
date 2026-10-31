import { describe, expect, it } from "vitest";
import { isSavedActivityVisibleToViewer } from "../src/modules/saved-activities/saved-activity-visibility.js";

const kycDev = { isProduction: false, kycProviderEnabled: false, kycManualReviewEnabled: false };

const activeHost = {
  id: "host-1",
  accountStatus: "ACTIVE" as const,
  emailVerifiedAt: new Date(),
  ageEligibilityStatus: "ELIGIBLE" as const,
  suspendedAt: null,
  deletedAt: null,
  identityVerificationStatus: "APPROVED" as const,
  identityVerificationApprovedAt: new Date(),
  identityVerificationValidUntil: null,
  identityVerificationRevokedAt: null,
  identityVerificationSessionId: "sess",
  adminReviewStatus: "APPROVED" as const,
  adminReviewVerificationSessionId: "sess",
  profile: null,
};

describe("saved-activity-visibility", () => {
  it("allows published public activities with discoverable hosts", () => {
    expect(
      isSavedActivityVisibleToViewer(
        {
          status: "PUBLISHED",
          audience: "PUBLIC",
          cancelledAt: null,
          host: activeHost,
        },
        false,
        kycDev,
      ),
    ).toBe(true);
  });

  it("denies when host is not discoverable", () => {
    expect(
      isSavedActivityVisibleToViewer(
        {
          status: "PUBLISHED",
          audience: "PUBLIC",
          cancelledAt: null,
          host: { ...activeHost, adminReviewStatus: "PENDING" },
        },
        false,
        kycDev,
      ),
    ).toBe(false);
  });
});
