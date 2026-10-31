import { describe, expect, it } from "vitest";
import {
  MEETUP_INVITE_NOTIFICATION_COPY,
  meetupInviteNotificationDedupeKey,
} from "../src/modules/meetup-invites/meetup-invite-notifications.js";
import { buildPrivacySafePushPayload } from "../src/modules/push-delivery/push-payload.js";

const FORBIDDEN = [
  "Secret Cafe",
  "1875 Purdy Ave",
  "Miami Beach",
  "Hello there",
  "Coffee Meetup",
  "Alex",
  "37.7",
];

describe("meetup invite notifications (028G)", () => {
  it("uses stable dedupe keys", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(meetupInviteNotificationDedupeKey(id, "received")).toBe(`meetup-invite:${id}:received`);
    expect(meetupInviteNotificationDedupeKey(id, "accepted")).toBe(`meetup-invite:${id}:accepted`);
  });

  it("keeps in-app copy free of private meetup fields", () => {
    for (const copy of Object.values(MEETUP_INVITE_NOTIFICATION_COPY)) {
      const blob = `${copy.title} ${copy.body}`.toLowerCase();
      for (const token of FORBIDDEN) {
        expect(blob).not.toContain(token.toLowerCase());
      }
    }
  });

  it("keeps push display copy generic for meetup types", () => {
    const types = [
      "MEETUP_INVITATION_RECEIVED",
      "MEETUP_INVITATION_ACCEPTED",
      "MEETUP_INVITATION_DECLINED",
      "MEETUP_INVITATION_WITHDRAWN",
    ] as const;
    for (const type of types) {
      const { data, notification } = buildPrivacySafePushPayload({
        notificationId: "n1",
        type,
        sourceId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(data.sourceId).toBeTruthy();
      expect(Object.keys(data).sort()).toEqual(["notificationId", "sourceId", "type"].sort());
      const blob = `${notification.title} ${notification.body} ${JSON.stringify(data)}`;
      for (const token of FORBIDDEN) {
        expect(blob.toLowerCase()).not.toContain(token.toLowerCase());
      }
    }
  });
});
