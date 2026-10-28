import { describe, expect, it } from "vitest";
import {
  canAccessAcceptedConversation,
  canInitiateSocialContact,
  canonicalizeParticipantPair,
  decideMessageRequestCreate,
  decideMessageRequestRespond,
  isSelfTarget,
  shouldAdvanceReadWatermark,
} from "../src/modules/social/social-policy.js";

const eligible = {
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
  identityVerificationSessionId: null,
  adminReviewStatus: "NOT_READY" as const,
  adminReviewVerificationSessionId: null,
};

const activated = {
  ...eligible,
  identityVerificationStatus: "APPROVED" as const,
  identityVerificationApprovedAt: new Date(),
  identityVerificationSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  adminReviewStatus: "APPROVED" as const,
  adminReviewVerificationSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

const kycApproved = {
  ...eligible,
  identityVerificationStatus: "APPROVED" as const,
  identityVerificationApprovedAt: new Date(),
};
const other = { ...eligible, userId: "22222222-2222-4222-8222-222222222222" };

describe("social policy", () => {
  it("rejects self-targets", () => {
    expect(isSelfTarget(eligible.userId, eligible.userId)).toBe(true);
    expect(isSelfTarget(eligible.userId, other.userId)).toBe(false);
  });

  it("requires D-03 visibility and no blocks to start contact", () => {
    expect(canInitiateSocialContact(eligible, other, "EVERYONE", false)).toBe(false);
    expect(canInitiateSocialContact(activated, other, "EVERYONE", false)).toBe(true);
    expect(canInitiateSocialContact(activated, other, "VERIFIED_USERS_ONLY", false)).toBe(true);
    expect(canInitiateSocialContact(kycApproved, other, "VERIFIED_USERS_ONLY", false)).toBe(false);
    expect(canInitiateSocialContact(eligible, other, "EVERYONE", true)).toBe(false);
    expect(canInitiateSocialContact(eligible, eligible, "EVERYONE", false)).toBe(false);
  });

  it("keeps accepted conversations behind eligibility and blocks", () => {
    expect(canAccessAcceptedConversation(activated, false)).toBe(true);
    expect(canAccessAcceptedConversation(eligible, false)).toBe(false);
    expect(canAccessAcceptedConversation(activated, true)).toBe(false);
  });

  it("does not reopen a declined message request", () => {
    expect(decideMessageRequestCreate(null)).toBe("create");
    expect(decideMessageRequestCreate("PENDING")).toBe("return_existing");
    expect(decideMessageRequestCreate("ACCEPTED")).toBe("return_existing");
    expect(decideMessageRequestCreate("DECLINED")).toBe("declined");
  });

  it("restricts accept/decline to the recipient", () => {
    expect(decideMessageRequestRespond("PENDING", false, "accept")).toBe("forbidden");
    expect(decideMessageRequestRespond("PENDING", true, "accept")).toBe("accept");
    expect(decideMessageRequestRespond("ACCEPTED", true, "accept")).toBe("already_accepted");
    expect(decideMessageRequestRespond("DECLINED", true, "accept")).toBe("already_declined");
    expect(decideMessageRequestRespond("ACCEPTED", true, "decline")).toBe("already_accepted");
    expect(decideMessageRequestRespond("PENDING", true, "decline")).toBe("decline");
  });

  it("advances read watermarks monotonically", () => {
    const older = { createdAt: new Date("2030-01-01T00:00:00.000Z"), id: "a" };
    const newer = { createdAt: new Date("2030-01-01T00:01:00.000Z"), id: "b" };
    expect(shouldAdvanceReadWatermark(null, older)).toBe(true);
    expect(shouldAdvanceReadWatermark(newer, older)).toBe(false);
    expect(shouldAdvanceReadWatermark(older, newer)).toBe(true);
    expect(
      shouldAdvanceReadWatermark(
        { createdAt: older.createdAt, id: "a" },
        { createdAt: older.createdAt, id: "b" },
      ),
    ).toBe(true);
  });

  it("orders conversation participants canonically", () => {
    expect(canonicalizeParticipantPair("b", "a")).toEqual({ low: "a", high: "b" });
    expect(canonicalizeParticipantPair("a", "b")).toEqual({ low: "a", high: "b" });
  });
});
