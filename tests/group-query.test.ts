import { describe, expect, it } from "vitest";
import { buildDiscoverableGroupsWhere } from "../src/modules/groups/group-query.js";

describe("group discovery query", () => {
  it("lists only ACTIVE groups and requires an eligible owner", () => {
    const where = buildDiscoverableGroupsWhere({ query: {} });
    expect(where.status).toBe("ACTIVE");
    expect(where.owner).toMatchObject({
      accountStatus: "ACTIVE",
      ageEligibilityStatus: "ELIGIBLE",
    });
    expect(JSON.stringify(where)).not.toMatch(/nearby|distance|verified/);
  });

  it("applies text, category, city, privacy and tag filters without geo keys", () => {
    const where = buildDiscoverableGroupsWhere({
      query: {
        q: "sunrise",
        category: "sports",
        city: "Miami",
        region: "FL",
        privacy: "PRIVATE_APPROVAL",
        tag: "miami",
      },
    });
    expect(where.name).toEqual({ contains: "sunrise", mode: "insensitive" });
    expect(where.category).toEqual({ slug: "sports" });
    expect(where.locationCity).toEqual({ equals: "Miami", mode: "insensitive" });
    expect(where.privacy).toBe("PRIVATE_APPROVAL");
    expect(where.tags).toEqual({ some: { tag: "miami" } });
    expect(where).not.toHaveProperty("latitude");
  });
});
