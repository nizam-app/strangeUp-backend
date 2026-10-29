import {
  MEETUP_INVITE_MIN_FUTURE_MS,
  MEETUP_INVITE_NOTE_MAX_LENGTH,
  MEETUP_INVITE_SCHEDULE_TIMEZONE_MAX_LENGTH,
  MEETUP_INVITE_TITLE_MAX_LENGTH,
  MEETUP_INVITE_VENUE_ADDRESS_MAX_LENGTH,
  MEETUP_INVITE_VENUE_CITY_MAX_LENGTH,
  MEETUP_INVITE_VENUE_LABEL_MAX_LENGTH,
  MEETUP_INVITE_VENUE_PLACE_NOTES_MAX_LENGTH,
  MEETUP_INVITE_VENUE_REGION_MAX_LENGTH,
} from "./meetup-invite.constants.js";

export type MeetupInviteValidationIssue =
  | "self_target"
  | "title_empty"
  | "title_too_long"
  | "note_too_long"
  | "schedule_not_future"
  | "schedule_timezone_invalid"
  | "schedule_timezone_too_long"
  | "venue_city_empty"
  | "venue_city_too_long"
  | "venue_region_empty"
  | "venue_region_too_long"
  | "venue_label_too_long"
  | "venue_address_too_long"
  | "venue_place_notes_too_long";

export type MeetupInviteCreateFieldValidation = {
  ok: true;
} | {
  ok: false;
  issues: MeetupInviteValidationIssue[];
};

export function isValidIanaTimeZone(timeZone: string): boolean {
  if (!timeZone.trim()) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function validateMeetupInviteCreateFields(input: {
  senderUserId: string;
  recipientUserId: string;
  title: string;
  note: string | null | undefined;
  scheduledStartsAt: Date;
  scheduleTimeZone: string;
  venueCity: string;
  venueRegion: string;
  venueLabel?: string | null;
  venueAddressLine?: string | null;
  venuePlaceNotes?: string | null;
  now?: Date;
}): MeetupInviteCreateFieldValidation {
  const issues: MeetupInviteValidationIssue[] = [];
  const now = input.now ?? new Date();

  if (input.senderUserId === input.recipientUserId) {
    issues.push("self_target");
  }

  const title = input.title.trim();
  if (!title) {
    issues.push("title_empty");
  } else if (title.length > MEETUP_INVITE_TITLE_MAX_LENGTH) {
    issues.push("title_too_long");
  }

  if (input.note != null && input.note.length > MEETUP_INVITE_NOTE_MAX_LENGTH) {
    issues.push("note_too_long");
  }

  if (input.scheduledStartsAt.getTime() < now.getTime() + MEETUP_INVITE_MIN_FUTURE_MS) {
    issues.push("schedule_not_future");
  }

  if (input.scheduleTimeZone.length > MEETUP_INVITE_SCHEDULE_TIMEZONE_MAX_LENGTH) {
    issues.push("schedule_timezone_too_long");
  } else if (!isValidIanaTimeZone(input.scheduleTimeZone)) {
    issues.push("schedule_timezone_invalid");
  }

  const city = input.venueCity.trim();
  const region = input.venueRegion.trim();
  if (!city) {
    issues.push("venue_city_empty");
  } else if (city.length > MEETUP_INVITE_VENUE_CITY_MAX_LENGTH) {
    issues.push("venue_city_too_long");
  }
  if (!region) {
    issues.push("venue_region_empty");
  } else if (region.length > MEETUP_INVITE_VENUE_REGION_MAX_LENGTH) {
    issues.push("venue_region_too_long");
  }

  if (input.venueLabel != null && input.venueLabel.length > MEETUP_INVITE_VENUE_LABEL_MAX_LENGTH) {
    issues.push("venue_label_too_long");
  }
  if (
    input.venueAddressLine != null &&
    input.venueAddressLine.length > MEETUP_INVITE_VENUE_ADDRESS_MAX_LENGTH
  ) {
    issues.push("venue_address_too_long");
  }
  if (
    input.venuePlaceNotes != null &&
    input.venuePlaceNotes.length > MEETUP_INVITE_VENUE_PLACE_NOTES_MAX_LENGTH
  ) {
    issues.push("venue_place_notes_too_long");
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
