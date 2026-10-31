import { describe, expect, it } from "vitest";
import {
  buildActivitySearchWhere,
  buildAdminActivitiesFilterFingerprint,
  buildAdminActivitiesListWhere,
} from "../../src/modules/admin/admin-activities-list-query.js";

const NOW = new Date("2026-10-31T12:00:00.000Z");

describe("admin-activities-list-query", () => {
  it("returns an empty where clause when no filters are set", () => {
    expect(buildAdminActivitiesListWhere({}, NOW)).toEqual({});
  });

  it("applies status, mode, audience, category, location, month, and when filters", () => {
    const where = buildAdminActivitiesListWhere(
      {
        status: "PUBLISHED",
        mode: "IN_PERSON",
        audience: "PUBLIC",
        category: "running-fitness",
        location: "Miami",
        month: "2026-10",
        when: "upcoming",
      },
      NOW,
    );
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { status: "PUBLISHED" },
        { mode: "IN_PERSON" },
        { audience: "PUBLIC" },
        { category: { slug: "running-fitness" } },
        {
          OR: [
            { locationCity: { contains: "Miami", mode: "insensitive" } },
            { locationRegion: { contains: "Miami", mode: "insensitive" } },
          ],
        },
        {
          startsAt: {
            gte: new Date("2026-10-01T00:00:00.000Z"),
            lt: new Date("2026-11-01T00:00:00.000Z"),
          },
        },
        { startsAt: { gte: NOW } },
      ]),
    );
  });

  it("filters past activities by startsAt", () => {
    const where = buildAdminActivitiesListWhere({ when: "past" }, NOW);
    expect(where.AND).toEqual(expect.arrayContaining([{ startsAt: { lt: NOW } }]));
  });

  it("filters in-session activities by start and end", () => {
    const where = buildAdminActivitiesListWhere({ when: "active" }, NOW);
    expect(where.AND).toEqual(
      expect.arrayContaining([{ startsAt: { lte: NOW }, endsAt: { gt: NOW } }]),
    );
  });

  it("matches activity id or host id for UUID search", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    expect(buildActivitySearchWhere(id)).toEqual({
      OR: [{ id }, { hostId: id }],
    });
  });

  it("includes category label and slug in text search", () => {
    const where = buildActivitySearchWhere("wellness");
    expect(where).toEqual(
      expect.objectContaining({
        OR: expect.arrayContaining([
          { title: { contains: "wellness", mode: "insensitive" } },
          { category: { is: { label: { contains: "wellness", mode: "insensitive" } } } },
          { category: { is: { slug: { contains: "wellness", mode: "insensitive" } } } },
        ]),
      }),
    );
  });

  it("changes fingerprint when location or month change", () => {
    const a = buildAdminActivitiesFilterFingerprint({ status: "PUBLISHED" });
    const b = buildAdminActivitiesFilterFingerprint({ status: "PUBLISHED", location: "Miami" });
    const c = buildAdminActivitiesFilterFingerprint({ status: "PUBLISHED", month: "2026-10" });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("rejects one-character name searches", () => {
    expect(() => buildActivitySearchWhere("a")).toThrow(/at least 2 characters/);
  });

  it("rejects one-character location filters", () => {
    expect(() => buildAdminActivitiesListWhere({ location: "M" }, NOW)).toThrow(
      /at least 2 characters/,
    );
  });
});
