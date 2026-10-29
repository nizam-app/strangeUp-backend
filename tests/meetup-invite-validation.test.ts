import { describe, expect, it } from "vitest";
import {
  isValidIanaTimeZone,
  validateMeetupInviteCreateFields,
} from "../src/modules/meetup-invites/meetup-invite-validation.js";

describe("meetup-invite-validation", () => {
  const base = {
    senderUserId: "11111111-1111-1111-1111-111111111111",
    recipientUserId: "22222222-2222-2222-2222-222222222222",
    title: "Coffee Meetup",
    note: "Hello",
    scheduledStartsAt: new Date("2030-06-01T18:00:00.000Z"),
    scheduleTimeZone: "America/New_York",
    venueCity: "Miami Beach",
    venueRegion: "FL",
    now: new Date("2026-06-01T12:00:00.000Z"),
  };

  it("accepts valid create fields", () => {
    expect(validateMeetupInviteCreateFields(base)).toEqual({ ok: true });
  });

  it("rejects self-target and past schedule", () => {
    const self = validateMeetupInviteCreateFields({
      ...base,
      recipientUserId: base.senderUserId,
    });
    expect(self.ok).toBe(false);
    if (!self.ok) {
      expect(self.issues).toContain("self_target");
    }

    const past = validateMeetupInviteCreateFields({
      ...base,
      scheduledStartsAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    expect(past.ok).toBe(false);
    if (!past.ok) {
      expect(past.issues).toContain("schedule_not_future");
    }
  });

  it("enforces 200-char note max", () => {
    const longNote = "x".repeat(201);
    const result = validateMeetupInviteCreateFields({ ...base, note: longNote });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContain("note_too_long");
    }
  });

  it("validates IANA timezone", () => {
    expect(isValidIanaTimeZone("America/New_York")).toBe(true);
    expect(isValidIanaTimeZone("Not/A_Zone")).toBe(false);
  });
});
