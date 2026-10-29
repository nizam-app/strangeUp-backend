/** D-28 / owner-approved foundation (Task 028C). */

export const MEETUP_INVITE_NOTE_MAX_LENGTH = 200;
export const MEETUP_INVITE_TITLE_MAX_LENGTH = 80;
export const MEETUP_INVITE_VENUE_CITY_MAX_LENGTH = 120;
export const MEETUP_INVITE_VENUE_REGION_MAX_LENGTH = 120;
export const MEETUP_INVITE_VENUE_LABEL_MAX_LENGTH = 160;
export const MEETUP_INVITE_VENUE_ADDRESS_MAX_LENGTH = 240;
export const MEETUP_INVITE_VENUE_PLACE_NOTES_MAX_LENGTH = 240;
export const MEETUP_INVITE_SCHEDULE_TIMEZONE_MAX_LENGTH = 64;

/** Minimum lead time before meetup start at create (server clock). */
export const MEETUP_INVITE_MIN_FUTURE_MS = 60_000;

export const MEETUP_INVITE_LIST_DEFAULT_LIMIT = 20;
export const MEETUP_INVITE_LIST_MAX_LIMIT = 50;

export const MEETUP_INVITE_NOT_FOUND_MESSAGE = "Meetup invitation not found";

export const MEETUP_INVITE_IDEMPOTENCY_HEADER = "idempotency-key";
