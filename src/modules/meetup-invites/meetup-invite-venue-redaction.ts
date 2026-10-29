import type { PersonalMeetupInviteStatus } from "../../../generated/prisma/client.js";
import type {
  MeetupInviteParticipantRole,
  MeetupInviteStoredVenue,
  MeetupInviteVenueView,
} from "./meetup-invite.types.js";
import { resolveEffectiveMeetupInviteStatus } from "./meetup-invite-state.js";

/**
 * D-28 §6 (owner-approved): recipient sees city/region before acceptance;
 * identifiable venue label and precise fields only after ACCEPTED.
 * Sender always sees submitted values.
 */
export function redactMeetupInviteVenueForViewer(input: {
  venue: MeetupInviteStoredVenue;
  viewerRole: MeetupInviteParticipantRole;
  storedStatus: PersonalMeetupInviteStatus;
  scheduledStartsAt: Date;
  now?: Date;
}): MeetupInviteVenueView {
  const effectiveStatus = resolveEffectiveMeetupInviteStatus(
    input.storedStatus,
    input.scheduledStartsAt,
    input.now,
  );

  const base = {
    city: input.venue.venueCity,
    region: input.venue.venueRegion,
  };

  if (input.viewerRole === "sender") {
    return {
      ...base,
      label: input.venue.venueLabel,
      addressLine: input.venue.venueAddressLine,
      placeNotes: input.venue.venuePlaceNotes,
    };
  }

  if (effectiveStatus === "ACCEPTED") {
    return {
      ...base,
      label: input.venue.venueLabel,
      addressLine: input.venue.venueAddressLine,
      placeNotes: input.venue.venuePlaceNotes,
    };
  }

  return {
    ...base,
    label: null,
    addressLine: null,
    placeNotes: null,
  };
}

/** Inbox/list cards: never expose precise fields (028D mapper should use this for all roles). */
export function redactMeetupInviteVenueForListCard(
  venue: MeetupInviteStoredVenue,
): Pick<MeetupInviteVenueView, "city" | "region" | "label" | "addressLine" | "placeNotes"> {
  return {
    city: venue.venueCity,
    region: venue.venueRegion,
    label: null,
    addressLine: null,
    placeNotes: null,
  };
}
