import { describe, expect, it } from "vitest";
import {
  canApplicantSubmitJoinRequest,
  isWaitlistFifoEligible,
  toParticipationPresentation,
} from "../src/modules/activities/activity-join-policy.js";

describe("activity-join-policy", () => {
  it("AUTO waitlist rows are FIFO eligible without hostApprovedAt", () => {
    expect(isWaitlistFifoEligible({ joinMode: "AUTO", hostApprovedAt: null })).toBe(true);
  });

  it("HOST_APPROVAL waitlist requires hostApprovedAt for FIFO", () => {
    expect(isWaitlistFifoEligible({ joinMode: "HOST_APPROVAL", hostApprovedAt: null })).toBe(
      false,
    );
    expect(
      isWaitlistFifoEligible({ joinMode: "HOST_APPROVAL", hostApprovedAt: new Date() }),
    ).toBe(true);
  });

  it("blocks reapplication after decline (unresolved policy)", () => {
    expect(canApplicantSubmitJoinRequest("DECLINED")).toEqual({
      allowed: false,
      reason: "declined_reapply_unresolved",
    });
    expect(canApplicantSubmitJoinRequest("CANCELLED")).toEqual({ allowed: true });
  });

  it("maps participation presentation for approval pending vs waitlisted", () => {
    const pending = toParticipationPresentation({
      joinMode: "HOST_APPROVAL",
      state: "PENDING",
      waitlistPosition: null,
      hostApprovedAt: null,
      joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(pending?.participationStatus).toBe("APPROVAL_PENDING");

    const waitlisted = toParticipationPresentation({
      joinMode: "HOST_APPROVAL",
      state: "WAITLISTED",
      waitlistPosition: 2,
      hostApprovedAt: new Date("2026-01-02T00:00:00.000Z"),
      joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(waitlisted?.participationStatus).toBe("APPROVAL_WAITLISTED");
  });
});
