import { describe, expect, it } from "vitest";
import {
  buildDiscoverableGroupsWhere,
  buildMyMembershipWhere,
} from "../src/modules/groups/group-query.js";

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

describe("my groups membership query (029B)", () => {
  const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("maps inventory views without geo or fabricated metrics", () => {
    expect(buildMyMembershipWhere({ userId, query: { view: "pending" } }).status).toBe("PENDING");
    expect(buildMyMembershipWhere({ userId, query: { view: "joined" } })).toMatchObject({
      status: "ACTIVE",
      role: "MEMBER",
    });
    expect(buildMyMembershipWhere({ userId, query: { view: "managed" } })).toMatchObject({
      status: "ACTIVE",
      role: { in: ["OWNER", "MODERATOR"] },
    });
    expect(buildMyMembershipWhere({ userId, query: { view: "all" } }).status).toEqual({
      in: ["ACTIVE", "PENDING"],
    });
  });

  it("defaults to ACTIVE and PENDING when no view is provided", () => {
    expect(buildMyMembershipWhere({ userId, query: {} }).status).toEqual({
      in: ["ACTIVE", "PENDING"],
    });
    expect(buildMyMembershipWhere({ userId, query: { status: "ACTIVE", role: "OWNER" } })).toEqual({
      userId,
      status: "ACTIVE",
      role: "OWNER",
    });
  });

  it("applies optional name search on the related group", () => {
    const where = buildMyMembershipWhere({ userId, query: { view: "all", q: "sunrise" } });
    expect(where.group).toEqual({ name: { contains: "sunrise", mode: "insensitive" } });
  });
});
