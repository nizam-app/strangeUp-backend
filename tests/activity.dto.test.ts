import { describe, expect, it } from "vitest";
import {
  publicActivityDtoContainsSensitiveKeys,
  toPublicActivityCard,
  toPublicActivityDetail,
} from "../src/modules/activities/activity.dto.js";

const source = {
  activityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Sunrise run",
  description: "Easy group run",
  category: { slug: "running" as const, label: "Running" },
  coverStorageKey: "host/activity/file.jpg",
  startsAt: new Date("2030-01-01T12:00:00.000Z"),
  endsAt: new Date("2030-01-01T13:00:00.000Z"),
  timeZone: "America/New_York",
  mode: "IN_PERSON" as const,
  status: "PUBLISHED" as const,
  audience: "PUBLIC" as const,
  venueName: "Bayfront Park",
  locationCity: "Miami",
  locationRegion: "FL",
  skillNotes: "Easy pace",
  gearNotes: "Water bottle",
  capacity: 10,
  confirmedCount: 3,
  waitlistEnabled: true,
  host: {
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    displayName: "Alex",
    username: "alexmilo",
    avatarStorageKey: "user/avatar.jpg",
    locationCity: "Miami",
    locationRegion: "FL",
  },
};

const hostPreview = {
  userId: source.host.userId,
  displayName: "Alex",
  username: "alexmilo",
  hasAvatar: true,
  locationCity: "Miami",
  locationRegion: "FL",
};

describe("activity DTO projection", () => {
  it("builds a public card without storage keys or meeting instructions", () => {
    const card = toPublicActivityCard(source, hostPreview);
    expect(card.spotsLeft).toBe(7);
    expect(card.hasCover).toBe(true);
    expect(publicActivityDtoContainsSensitiveKeys(card)).toBe(false);
    expect(JSON.stringify(card)).not.toMatch(
      /meetingInstructions|virtualMeetingDetails|coverStorageKey/,
    );
  });

  it("keeps public detail free of private meeting fields", () => {
    const detail = toPublicActivityDetail(source, hostPreview, null, false);
    expect(detail.description).toBe("Easy group run");
    expect(detail.meetingAvailable).toBe(false);
    expect(publicActivityDtoContainsSensitiveKeys(detail)).toBe(false);
    expect(detail).not.toHaveProperty("meetingInstructions");
    expect(detail).not.toHaveProperty("virtualMeetingDetails");
  });
});
