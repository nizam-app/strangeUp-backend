import { createHash } from "node:crypto";

export type MeetupInviteCreatePayloadFingerprint = {
  recipientUserId: string;
  meetupType: string;
  title: string;
  scheduledStartsAt: string;
  scheduleTimeZone: string;
  venueCity: string;
  venueRegion: string;
  venueLabel: string | null;
  venueAddressLine: string | null;
  venuePlaceNotes: string | null;
  note: string | null;
};

export function scopeMeetupInviteCreateIdempotencyKey(
  senderUserId: string,
  headerKey: string,
): string {
  const trimmed = headerKey.trim();
  return `meetup-invite:create:${senderUserId}:${trimmed}`;
}

export function hashMeetupInviteCreatePayload(
  payload: MeetupInviteCreatePayloadFingerprint,
): string {
  const normalized = JSON.stringify(payload);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
