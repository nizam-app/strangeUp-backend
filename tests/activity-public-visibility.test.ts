import { describe, expect, it } from "vitest";
import { AppError } from "../src/common/errors/app-error.js";
import {
  assertPublicActivityDiscoverableToNonHostViewer,
  isPublicActivityDiscoverableToNonHostViewer,
} from "../src/modules/activities/activity-public-visibility.js";

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

const pendingHost = { ...activeHost, adminReviewStatus: "PENDING" as const };

describe("activity-public-visibility", () => {
  it("allows published public activities with activated hosts", () => {
    expect(
      isPublicActivityDiscoverableToNonHostViewer(
        { status: "PUBLISHED", audience: "PUBLIC", host: activeHost },
        kycDev,
      ),
    ).toBe(true);
  });

  it("denies when host loses main-app activation", () => {
    expect(
      isPublicActivityDiscoverableToNonHostViewer(
        { status: "PUBLISHED", audience: "PUBLIC", host: pendingHost },
        kycDev,
      ),
    ).toBe(false);
  });

  it("assert throws ACTIVITY_NOT_FOUND for concealed activities", () => {
    expect(() =>
      assertPublicActivityDiscoverableToNonHostViewer(
        { status: "PUBLISHED", audience: "PUBLIC", host: pendingHost },
        kycDev,
      ),
    ).toThrow(AppError);
  });
});
