import { describe, expect, it } from "vitest";
import {
  groupDtoContainsSensitiveKeys,
  spotsLeft,
  toGroupSummaryDto,
} from "../src/modules/groups/group.dto.js";
import {
  decodeGroupCreatedCursor,
  decodeGroupPinnedCursor,
  encodeGroupCreatedCursor,
  encodeGroupPinnedCursor,
} from "../src/modules/groups/group-cursor.js";

describe("group DTO and cursors", () => {
  it("builds a public-safe summary without fabricated badges or distance", () => {
    const dto = toGroupSummaryDto({
      groupId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      name: "Sunrise Riders",
      description: "Morning rides",
      category: { slug: "sports", label: "Sports" },
      tags: ["miami"],
      locationCity: "Miami",
      locationRegion: "FL",
      privacy: "PUBLIC",
      meetupFrequency: "WEEKLY",
      memberCapacity: 10,
      memberCount: 3,
      coverStorageKey: "key",
      status: "ACTIVE",
      myMembership: null,
    });
    expect(dto.memberCount).toBe(3);
    expect(dto.spotsLeft).toBe(7);
    expect(dto.hasCover).toBe(true);
    expect(dto).not.toHaveProperty("verified");
    expect(dto).not.toHaveProperty("verifiedCommunity");
    expect(dto).not.toHaveProperty("distanceMiles");
    expect(groupDtoContainsSensitiveKeys(dto)).toBe(false);
  });

  it("flags storage and identity keys that must never appear on group DTOs", () => {
    expect(groupDtoContainsSensitiveKeys({ groupId: "x", coverStorageKey: "secret" })).toBe(true);
    expect(groupDtoContainsSensitiveKeys({ meetingInstructions: "gate code" })).toBe(true);
    expect(groupDtoContainsSensitiveKeys({ verifiedCommunity: true })).toBe(true);
  });

  it("returns null spotsLeft when capacity is unlimited", () => {
    expect(spotsLeft(null, 12)).toBeNull();
  });

  it("round-trips cursors and rejects garbage", () => {
    const created = encodeGroupCreatedCursor({
      createdAt: "2030-01-01T00:00:00.000Z",
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(decodeGroupCreatedCursor(created).id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    const pinned = encodeGroupPinnedCursor({
      pinned: 1,
      createdAt: "2030-01-01T00:00:00.000Z",
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(decodeGroupPinnedCursor(pinned).pinned).toBe(1);
    expect(() => decodeGroupCreatedCursor("nope")).toThrow();
    expect(() => decodeGroupPinnedCursor(created)).toThrow();
  });
});
