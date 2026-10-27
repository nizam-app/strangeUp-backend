import { describe, expect, it } from "vitest";
import {
  activityListQuerySchema,
  createActivityBodySchema,
  patchActivityBodySchema,
} from "../src/modules/activities/activity.validation.js";

const futureStart = "2030-06-15T14:00:00.000Z";
const futureEnd = "2030-06-15T16:00:00.000Z";

const validCreate = {
  title: "Morning ride",
  category: "biking",
  startsAt: futureStart,
  endsAt: futureEnd,
  timeZone: "America/New_York",
  mode: "IN_PERSON",
  capacity: 8,
};

describe("activity validation", () => {
  it("accepts a valid draft create body", () => {
    const parsed = createActivityBodySchema.parse(validCreate);
    expect(parsed.title).toBe("Morning ride");
    expect(parsed.waitlistEnabled).toBeUndefined();
  });

  it("rejects description longer than 500", () => {
    expect(() =>
      createActivityBodySchema.parse({ ...validCreate, description: "x".repeat(501) }),
    ).toThrow();
  });

  it("rejects endsAt before startsAt", () => {
    expect(() =>
      createActivityBodySchema.parse({
        ...validCreate,
        startsAt: futureEnd,
        endsAt: futureStart,
      }),
    ).toThrow();
  });

  it("rejects unknown category slugs", () => {
    expect(() => createActivityBodySchema.parse({ ...validCreate, category: "food" })).toThrow();
  });

  it("rejects invalid IANA time zones", () => {
    expect(() =>
      createActivityBodySchema.parse({ ...validCreate, timeZone: "Not/AZone" }),
    ).toThrow();
  });

  it("rejects unknown keys on create", () => {
    expect(() =>
      createActivityBodySchema.parse({ ...validCreate, hostId: "nope", verifiedOnly: true }),
    ).toThrow();
  });

  it("rejects empty patch bodies", () => {
    expect(() => patchActivityBodySchema.parse({})).toThrow();
  });

  it("rejects unknown discovery category filters", () => {
    expect(() => activityListQuerySchema.parse({ category: "music" })).toThrow();
  });

  it("accepts discovery filters without geo fields", () => {
    const parsed = activityListQuerySchema.parse({
      q: "ride",
      category: "running",
      city: "Miami",
      region: "FL",
      mode: "VIRTUAL",
    });
    expect(parsed).not.toHaveProperty("radius");
    expect(parsed).not.toHaveProperty("lat");
  });

  it("rejects capacity outside bounds", () => {
    expect(() => createActivityBodySchema.parse({ ...validCreate, capacity: 0 })).toThrow();
    expect(() => createActivityBodySchema.parse({ ...validCreate, capacity: 501 })).toThrow();
  });
});
