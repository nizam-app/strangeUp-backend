import { describe, expect, it } from "vitest";
import {
  FAVORITE_ACTIVITY_MAX_ITEMS,
  replaceFavoriteActivitiesBodySchema,
} from "../src/modules/favorite-activities/favorite-activities.validation.js";

describe("replaceFavoriteActivitiesBodySchema", () => {
  it("accepts empty and valid items", () => {
    expect(
      replaceFavoriteActivitiesBodySchema.parse({ favoriteActivities: [] }).favoriteActivities,
    ).toEqual([]);
    expect(
      replaceFavoriteActivitiesBodySchema.parse({
        favoriteActivities: [
          {
            title: "Morning Run",
            skillLevel: "BEGINNER",
            cadence: "WEEKLY",
            scheduleNote: "Tue 6am",
            placeLabel: "Central Park",
          },
        ],
      }).favoriteActivities,
    ).toHaveLength(1);
  });

  it("rejects too many items and invalid enums", () => {
    const tooMany = Array.from({ length: FAVORITE_ACTIVITY_MAX_ITEMS + 1 }, (_, i) => ({
      title: `Activity ${i}`,
      skillLevel: "BEGINNER" as const,
      cadence: "CASUAL" as const,
    }));
    expect(() =>
      replaceFavoriteActivitiesBodySchema.parse({ favoriteActivities: tooMany }),
    ).toThrow();
    expect(() =>
      replaceFavoriteActivitiesBodySchema.parse({
        favoriteActivities: [{ title: "X", skillLevel: "PRO", cadence: "WEEKLY" }],
      }),
    ).toThrow();
  });

  it("rejects extra keys and missing array", () => {
    expect(() => replaceFavoriteActivitiesBodySchema.parse({})).toThrow();
    expect(() =>
      replaceFavoriteActivitiesBodySchema.parse({ favoriteActivities: [], extra: true }),
    ).toThrow();
  });
});
