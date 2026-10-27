import { describe, expect, it } from "vitest";
import { INTEREST_CATALOG, INTEREST_SLUGS } from "../src/modules/interests/interest-catalog.js";
import { replaceInterestsBodySchema } from "../src/modules/interests/interests.validation.js";

describe("interest catalog", () => {
  it("defines ten approved slugs and labels in deterministic order", () => {
    expect(INTEREST_CATALOG).toHaveLength(10);
    expect(INTEREST_SLUGS).toEqual([
      "biking",
      "fitness",
      "outdoor",
      "social",
      "sports",
      "swimming",
      "hiking",
      "travel",
      "music",
      "food",
    ]);
    expect(INTEREST_CATALOG.map((e) => e.label)).toEqual([
      "Biking",
      "Fitness",
      "Outdoor",
      "Social",
      "Sports",
      "Swimming",
      "Hiking",
      "Travel",
      "Music",
      "Food",
    ]);
    const orders = INTEREST_CATALOG.map((e) => e.sortOrder);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("replaceInterestsBodySchema", () => {
  it("accepts zero, one, and ten distinct slugs", () => {
    expect(replaceInterestsBodySchema.parse({ interests: [] }).interests).toEqual([]);
    expect(replaceInterestsBodySchema.parse({ interests: ["biking"] }).interests).toEqual([
      "biking",
    ]);
    expect(replaceInterestsBodySchema.parse({ interests: INTEREST_SLUGS }).interests).toHaveLength(
      10,
    );
  });

  it("rejects eleven entries", () => {
    const eleven = [...INTEREST_SLUGS, "biking"];
    expect(() => replaceInterestsBodySchema.parse({ interests: eleven })).toThrow();
  });

  it("rejects unknown, duplicate, uppercase, and free-text slugs", () => {
    expect(() => replaceInterestsBodySchema.parse({ interests: ["unknown"] })).toThrow();
    expect(() => replaceInterestsBodySchema.parse({ interests: ["biking", "biking"] })).toThrow();
    expect(() => replaceInterestsBodySchema.parse({ interests: ["Biking"] })).toThrow();
    expect(() => replaceInterestsBodySchema.parse({ interests: ["custom tag"] })).toThrow();
  });

  it("rejects wrong shape and extraneous fields", () => {
    expect(() => replaceInterestsBodySchema.parse({})).toThrow();
    expect(() => replaceInterestsBodySchema.parse({ interests: "biking" })).toThrow();
    expect(() => replaceInterestsBodySchema.parse({ interests: [], extra: true })).toThrow();
  });
});
