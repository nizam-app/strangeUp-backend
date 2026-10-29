import { describe, expect, it } from "vitest";
import {
  decideMeetupInviteTransition,
  isAllowedStoredMeetupInviteTransition,
  isMeetupInviteTerminalStatus,
  resolveEffectiveMeetupInviteStatus,
} from "../src/modules/meetup-invites/meetup-invite-state.js";

const future = new Date("2030-06-01T18:00:00.000Z");
const past = new Date("2020-06-01T18:00:00.000Z");
const now = new Date("2026-06-01T12:00:00.000Z");

describe("meetup-invite-state", () => {
  it("lazy-expires PENDING when scheduledStartsAt has passed", () => {
    expect(resolveEffectiveMeetupInviteStatus("PENDING", past, now)).toBe("EXPIRED");
    expect(resolveEffectiveMeetupInviteStatus("PENDING", future, now)).toBe("PENDING");
    expect(resolveEffectiveMeetupInviteStatus("ACCEPTED", past, now)).toBe("ACCEPTED");
  });

  it("allows recipient accept and idempotent noop", () => {
    const apply = decideMeetupInviteTransition({
      action: "accept",
      actorRole: "recipient",
      storedStatus: "PENDING",
      scheduledStartsAt: future,
      now,
    });
    expect(apply).toEqual({ kind: "apply", nextStatus: "ACCEPTED" });

    const noop = decideMeetupInviteTransition({
      action: "accept",
      actorRole: "recipient",
      storedStatus: "ACCEPTED",
      scheduledStartsAt: future,
      now,
    });
    expect(noop).toEqual({ kind: "noop", status: "ACCEPTED" });
  });

  it("rejects sender accept and recipient withdraw", () => {
    expect(
      decideMeetupInviteTransition({
        action: "accept",
        actorRole: "sender",
        storedStatus: "PENDING",
        scheduledStartsAt: future,
        now,
      }),
    ).toEqual({ kind: "reject", reason: "wrong_actor" });

    expect(
      decideMeetupInviteTransition({
        action: "withdraw",
        actorRole: "recipient",
        storedStatus: "PENDING",
        scheduledStartsAt: future,
        now,
      }),
    ).toEqual({ kind: "reject", reason: "wrong_actor" });
  });

  it("blocks accept/decline/withdraw on effective EXPIRED pending", () => {
    for (const action of ["accept", "decline", "withdraw"] as const) {
      const role = action === "withdraw" ? "sender" : "recipient";
      expect(
        decideMeetupInviteTransition({
          action,
          actorRole: role,
          storedStatus: "PENDING",
          scheduledStartsAt: past,
          now,
        }),
      ).toEqual({ kind: "reject", reason: "not_pending" });
    }
  });

  it("allows sender withdraw on PENDING", () => {
    expect(
      decideMeetupInviteTransition({
        action: "withdraw",
        actorRole: "sender",
        storedStatus: "PENDING",
        scheduledStartsAt: future,
        now,
      }),
    ).toEqual({ kind: "apply", nextStatus: "WITHDRAWN" });
  });

  it("expire action applies only when start time passed", () => {
    expect(
      decideMeetupInviteTransition({
        action: "expire",
        actorRole: "sender",
        storedStatus: "PENDING",
        scheduledStartsAt: past,
        now,
      }),
    ).toEqual({ kind: "apply", nextStatus: "EXPIRED" });

    expect(
      decideMeetupInviteTransition({
        action: "expire",
        actorRole: "sender",
        storedStatus: "PENDING",
        scheduledStartsAt: future,
        now,
      }),
    ).toEqual({ kind: "reject", reason: "pending_not_yet_due_for_expiry" });
  });

  it("terminal stored states have no outbound transitions", () => {
    for (const status of ["ACCEPTED", "DECLINED", "WITHDRAWN", "EXPIRED"] as const) {
      expect(isMeetupInviteTerminalStatus(status)).toBe(true);
      expect(isAllowedStoredMeetupInviteTransition(status, "PENDING")).toBe(false);
    }
    expect(isAllowedStoredMeetupInviteTransition("PENDING", "ACCEPTED")).toBe(true);
  });
});
