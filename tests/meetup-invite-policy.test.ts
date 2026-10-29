import { describe, expect, it } from "vitest";
import {
  canAccessMeetupInviteAsParticipant,
  canCreateMeetupInviteGivenExistingPending,
  evaluateMeetupInviteMutation,
  meetupInviteActionAvailability,
  resolveMeetupInviteParticipantRole,
} from "../src/modules/meetup-invites/meetup-invite-policy.js";

const senderId = "11111111-1111-1111-1111-111111111111";
const recipientId = "22222222-2222-2222-2222-222222222222";
const future = new Date("2030-06-01T18:00:00.000Z");

describe("meetup-invite-policy", () => {
  it("resolves participant roles and denies third parties", () => {
    expect(
      resolveMeetupInviteParticipantRole({ viewerUserId: senderId, senderId, recipientId }),
    ).toBe("sender");
    expect(
      resolveMeetupInviteParticipantRole({ viewerUserId: recipientId, senderId, recipientId }),
    ).toBe("recipient");
    expect(
      resolveMeetupInviteParticipantRole({
        viewerUserId: "33333333-3333-3333-3333-333333333333",
        senderId,
        recipientId,
      }),
    ).toBeNull();
    expect(
      canAccessMeetupInviteAsParticipant({
        viewerUserId: recipientId,
        senderId,
        recipientId,
      }),
    ).toBe(true);
  });

  it("enforces single pending pair constraint at application layer", () => {
    expect(canCreateMeetupInviteGivenExistingPending(true)).toBe(false);
    expect(canCreateMeetupInviteGivenExistingPending(false)).toBe(true);
  });

  it("exposes action flags for pending invites", () => {
    expect(
      meetupInviteActionAvailability({
        ctx: { viewerUserId: recipientId, senderId, recipientId },
        storedStatus: "PENDING",
        scheduledStartsAt: future,
      }),
    ).toEqual({ canAccept: true, canDecline: true, canWithdraw: false });

    expect(
      meetupInviteActionAvailability({
        ctx: { viewerUserId: senderId, senderId, recipientId },
        storedStatus: "PENDING",
        scheduledStartsAt: future,
      }),
    ).toEqual({ canAccept: false, canDecline: false, canWithdraw: true });
  });

  it("evaluateMeetupInviteMutation rejects non-participants", () => {
    expect(
      evaluateMeetupInviteMutation({
        action: "accept",
        ctx: {
          viewerUserId: "33333333-3333-3333-3333-333333333333",
          senderId,
          recipientId,
        },
        storedStatus: "PENDING",
        scheduledStartsAt: future,
      }),
    ).toEqual({ kind: "reject", reason: "wrong_actor" });
  });
});
