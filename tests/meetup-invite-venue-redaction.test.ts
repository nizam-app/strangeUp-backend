import { describe, expect, it } from "vitest";
import {
  redactMeetupInviteVenueForListCard,
  redactMeetupInviteVenueForViewer,
} from "../src/modules/meetup-invites/meetup-invite-venue-redaction.js";

const venue = {
  venueCity: "Miami Beach",
  venueRegion: "FL",
  venueLabel: "Panther Coffee",
  venueAddressLine: "1875 Purdy Ave",
  venuePlaceNotes: "Side entrance",
};

const future = new Date("2030-06-01T18:00:00.000Z");
const now = new Date("2026-06-01T12:00:00.000Z");

describe("meetup-invite-venue-redaction", () => {
  it("sender always sees submitted venue fields", () => {
    expect(
      redactMeetupInviteVenueForViewer({
        venue,
        viewerRole: "sender",
        storedStatus: "PENDING",
        scheduledStartsAt: future,
        now,
      }),
    ).toEqual({
      city: "Miami Beach",
      region: "FL",
      label: "Panther Coffee",
      addressLine: "1875 Purdy Ave",
      placeNotes: "Side entrance",
    });
  });

  it("recipient sees city/region only until ACCEPTED", () => {
    expect(
      redactMeetupInviteVenueForViewer({
        venue,
        viewerRole: "recipient",
        storedStatus: "PENDING",
        scheduledStartsAt: future,
        now,
      }),
    ).toEqual({
      city: "Miami Beach",
      region: "FL",
      label: null,
      addressLine: null,
      placeNotes: null,
    });

    expect(
      redactMeetupInviteVenueForViewer({
        venue,
        viewerRole: "recipient",
        storedStatus: "ACCEPTED",
        scheduledStartsAt: future,
        now,
      }),
    ).toMatchObject({ label: "Panther Coffee", addressLine: "1875 Purdy Ave" });
  });

  it("list cards never expose precise venue fields", () => {
    expect(redactMeetupInviteVenueForListCard(venue)).toEqual({
      city: "Miami Beach",
      region: "FL",
      label: null,
      addressLine: null,
      placeNotes: null,
    });
  });
});
