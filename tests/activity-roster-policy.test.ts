import { describe, expect, it } from "vitest";
import { canViewActivityConfirmedRoster } from "../src/modules/activities/activity-roster-policy.js";

describe("activity-roster-policy", () => {
  it("allows manage-eligible host", () => {
    expect(
      canViewActivityConfirmedRoster({
        isHost: true,
        hostCanManage: true,
        viewerParticipationState: null,
      }),
    ).toBe(true);
  });

  it("denies host without manage access", () => {
    expect(
      canViewActivityConfirmedRoster({
        isHost: true,
        hostCanManage: false,
        viewerParticipationState: null,
      }),
    ).toBe(false);
  });

  it("allows CONFIRMED participant only", () => {
    expect(
      canViewActivityConfirmedRoster({
        isHost: false,
        hostCanManage: false,
        viewerParticipationState: "CONFIRMED",
      }),
    ).toBe(true);
    for (const state of ["PENDING", "DECLINED", "WAITLISTED", "CANCELLED"] as const) {
      expect(
        canViewActivityConfirmedRoster({
          isHost: false,
          hostCanManage: false,
          viewerParticipationState: state,
        }),
      ).toBe(false);
    }
  });
});
