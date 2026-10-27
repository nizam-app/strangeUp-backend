import { describe, expect, it } from "vitest";
import type { IdentityVerificationStatus } from "../generated/prisma/client.js";
import { hasCurrentTrustedKycForEnforcement } from "../src/modules/activities/activity-kyc.js";
import {
  canAccessMeetingDetails,
  canChangePublishedSchedule,
  canDecreaseCapacity,
  canPublishAudience,
  decideWaitlistPromotion,
  isUpcomingInstant,
  resolveJoinPath,
} from "../src/modules/activities/activity-policy.js";

const kycDev = { isProduction: false, kycProviderEnabled: false };
const kycProdClosed = { isProduction: true, kycProviderEnabled: false };

function kycTrust(status: IdentityVerificationStatus) {
  return {
    identityVerificationStatus: status,
    identityVerificationApprovedAt: status === "APPROVED" ? new Date() : null,
    identityVerificationValidUntil: null,
    identityVerificationRevokedAt: null,
  };
}

describe("activity KYC enforcement", () => {
  it("accepts APPROVED only outside production fail-closed", () => {
    expect(hasCurrentTrustedKycForEnforcement(kycTrust("APPROVED"), kycDev)).toBe(true);
    expect(hasCurrentTrustedKycForEnforcement(kycTrust("PENDING"), kycDev)).toBe(false);
    expect(hasCurrentTrustedKycForEnforcement(kycTrust("REJECTED"), kycDev)).toBe(false);
    expect(hasCurrentTrustedKycForEnforcement(kycTrust("NOT_STARTED"), kycDev)).toBe(false);
  });

  it("fails closed in production without a provider", () => {
    expect(hasCurrentTrustedKycForEnforcement(kycTrust("APPROVED"), kycProdClosed)).toBe(false);
  });

  it("denies revoked or expired validity windows", () => {
    expect(
      hasCurrentTrustedKycForEnforcement(
        {
          identityVerificationStatus: "APPROVED",
          identityVerificationApprovedAt: new Date(),
          identityVerificationValidUntil: new Date("2020-01-01T00:00:00.000Z"),
          identityVerificationRevokedAt: null,
        },
        kycDev,
        new Date(),
      ),
    ).toBe(false);
    expect(
      hasCurrentTrustedKycForEnforcement(
        {
          identityVerificationStatus: "APPROVED",
          identityVerificationApprovedAt: new Date(),
          identityVerificationValidUntil: null,
          identityVerificationRevokedAt: new Date(),
        },
        kycDev,
      ),
    ).toBe(false);
  });
});

describe("activity state and join decisions", () => {
  it("does not treat FOLLOWERS_ONLY as publishable", () => {
    expect(canPublishAudience("PUBLIC")).toBe(true);
    expect(canPublishAudience("FOLLOWERS_ONLY")).toBe(false);
  });

  it("blocks schedule changes after anyone has joined", () => {
    expect(canChangePublishedSchedule(0)).toBe(true);
    expect(canChangePublishedSchedule(1)).toBe(false);
  });

  it("prevents capacity below confirmed count", () => {
    expect(canDecreaseCapacity(4, 4)).toBe(true);
    expect(canDecreaseCapacity(3, 4)).toBe(false);
  });

  it("treats past start times as not upcoming", () => {
    expect(isUpcomingInstant(new Date("2020-01-01T00:00:00.000Z"), new Date())).toBe(false);
    expect(isUpcomingInstant(new Date("2035-01-01T00:00:00.000Z"), new Date())).toBe(true);
  });

  it("requires KYC to confirm real-world seats but allows full-capacity waitlist", () => {
    const base = {
      isHost: false,
      status: "PUBLISHED" as const,
      upcoming: true,
      confirmedCount: 3,
      capacity: 8,
      waitlistEnabled: true,
      existingState: null,
      mode: "IN_PERSON" as const,
      kycTrust: kycTrust("NOT_STARTED"),
      kyc: kycDev,
    };
    expect(resolveJoinPath(base)).toBe("kyc_required");
    expect(resolveJoinPath({ ...base, confirmedCount: 8 })).toBe("waitlist");
    expect(resolveJoinPath({ ...base, mode: "VIRTUAL" })).toBe("confirm");
    expect(resolveJoinPath({ ...base, kycTrust: kycTrust("APPROVED") })).toBe("confirm");
    expect(resolveJoinPath({ ...base, status: "DRAFT" })).toBe("closed");
    expect(resolveJoinPath({ ...base, isHost: true })).toBe("host");
  });

  it("holds the waitlist head instead of skipping ineligible users", () => {
    const queued = {
      accountEligible: true,
      blockedWithHost: false,
      kycTrust: kycTrust("NOT_STARTED"),
    };
    expect(
      decideWaitlistPromotion({
        hasOpenSeat: true,
        nextQueued: queued,
        mode: "IN_PERSON",
        kyc: kycDev,
      }),
    ).toEqual({ action: "hold_queue", reason: "kyc" });
    expect(
      decideWaitlistPromotion({
        hasOpenSeat: true,
        nextQueued: { ...queued, kycTrust: kycTrust("APPROVED") },
        mode: "IN_PERSON",
        kyc: kycDev,
      }),
    ).toEqual({ action: "promote" });
    expect(
      decideWaitlistPromotion({
        hasOpenSeat: true,
        nextQueued: { ...queued, blockedWithHost: true, kycTrust: kycTrust("APPROVED") },
        mode: "IN_PERSON",
        kyc: kycDev,
      }),
    ).toEqual({ action: "hold_queue", reason: "blocked" });
  });

  it("exposes meeting details only to host or currently eligible confirmed participants", () => {
    const base = {
      isHost: false,
      participationState: "CONFIRMED" as const,
      activityStatus: "PUBLISHED" as const,
      mode: "IN_PERSON" as const,
      kycTrust: kycTrust("APPROVED"),
      accountEligible: true,
      blockedWithHost: false,
      kyc: kycDev,
    };
    expect(canAccessMeetingDetails(base)).toBe(true);
    expect(canAccessMeetingDetails({ ...base, kycTrust: kycTrust("PENDING") })).toBe(false);
    expect(canAccessMeetingDetails({ ...base, participationState: "WAITLISTED" })).toBe(false);
    expect(canAccessMeetingDetails({ ...base, isHost: true, participationState: null })).toBe(true);
    expect(canAccessMeetingDetails({ ...base, blockedWithHost: true })).toBe(false);
  });
});
