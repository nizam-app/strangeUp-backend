import { describe, expect, it } from "vitest";
import {
  decodeActivityStartsCursor,
  encodeActivityStartsCursor,
} from "../src/modules/activities/activity-cursor.js";
import { buildDiscoverableActivitiesWhere } from "../src/modules/activities/activity-query.js";

describe("activity discovery query", () => {
  const now = new Date("2030-01-01T00:00:00.000Z");

  it("limits the public list to published public upcoming activities", () => {
    const where = buildDiscoverableActivitiesWhere({
      now,
      blockedHostIds: ["11111111-1111-4111-8111-111111111111"],
      query: {},
    });
    expect(where.status).toBe("PUBLISHED");
    expect(where.audience).toBe("PUBLIC");
    expect(where.startsAt).toEqual({ gte: now });
    expect(where.hostId).toEqual({ notIn: ["11111111-1111-4111-8111-111111111111"] });
    expect(where.host).toMatchObject({ adminReviewStatus: "APPROVED" });
    expect(JSON.stringify(where)).not.toMatch(/meetingInstructions/);
  });

  it("applies text, category, city, region and mode filters without geo keys", () => {
    const where = buildDiscoverableActivitiesWhere({
      now,
      blockedHostIds: [],
      query: {
        q: "ride",
        category: "biking",
        city: "Miami",
        region: "FL",
        mode: "IN_PERSON",
      },
    });
    const andClauses = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    expect(andClauses[0]).toEqual({
      OR: [
        { title: { contains: "ride", mode: "insensitive" } },
        {
          host: {
            is: {
              profile: {
                is: {
                  OR: [
                    { displayName: { contains: "ride", mode: "insensitive" } },
                    { username: { contains: "ride", mode: "insensitive" } },
                  ],
                },
              },
            },
          },
        },
      ],
    });
    expect(where.category).toEqual({ slug: "biking" });
    expect(where.locationCity).toEqual({ equals: "Miami", mode: "insensitive" });
    expect(where.mode).toBe("IN_PERSON");
    expect(where).not.toHaveProperty("latitude");
    expect(where).not.toHaveProperty("distance");
  });

  it("round-trips list cursors", () => {
    const encoded = encodeActivityStartsCursor({
      startsAt: "2030-01-01T12:00:00.000Z",
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(decodeActivityStartsCursor(encoded)).toEqual({
      startsAt: "2030-01-01T12:00:00.000Z",
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });
});
