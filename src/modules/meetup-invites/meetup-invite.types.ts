import type { PersonalMeetupInviteStatus } from "../../../generated/prisma/client.js";

export type MeetupInviteParticipantRole = "sender" | "recipient";

export type MeetupInviteMutationAction = "accept" | "decline" | "withdraw" | "expire";

export type MeetupInviteStoredVenue = {
  venueCity: string;
  venueRegion: string;
  venueLabel: string | null;
  venueAddressLine: string | null;
  venuePlaceNotes: string | null;
};

export type MeetupInviteVenueView = {
  city: string;
  region: string;
  label: string | null;
  addressLine: string | null;
  placeNotes: string | null;
};

export type MeetupInviteScheduleSnapshot = {
  status: PersonalMeetupInviteStatus;
  scheduledStartsAt: Date;
};

export const MEETUP_INVITE_TERMINAL_STATUSES: ReadonlySet<PersonalMeetupInviteStatus> = new Set([
  "ACCEPTED",
  "DECLINED",
  "WITHDRAWN",
  "EXPIRED",
]);
