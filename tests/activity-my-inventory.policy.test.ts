import { describe, expect, it } from "vitest";
import {
  activityStartsAtWhere,
  compareInventoryAsc,
  compareInventoryDesc,
  mergeInventoryPages,
  rowAfterCursor,
} from "../src/modules/activities/activity-my-inventory.policy.js";

describe("activity-my-inventory.policy", () => {
  it("filters upcoming and past startsAt windows", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    expect(activityStartsAtWhere("all", now)).toEqual({});
    expect(activityStartsAtWhere("upcoming", now)).toEqual({ startsAt: { gt: now } });
    expect(activityStartsAtWhere("past", now)).toEqual({ startsAt: { lte: now } });
  });

  it("merges upcoming host and joined rows without duplicate activity ids", () => {
    const a = { activityId: "a", startsAt: new Date("2026-02-01T10:00:00.000Z") };
    const b = { activityId: "b", startsAt: new Date("2026-02-02T10:00:00.000Z") };
    const dup = { activityId: "a", startsAt: new Date("2026-02-01T11:00:00.000Z") };
    const { page, hasMore } = mergeInventoryPages([[a, b], [dup]], 2, compareInventoryAsc);
    expect(page.map((row) => row.activityId)).toEqual(["a", "b"]);
    expect(hasMore).toBe(false);
  });

  it("applies cursor ordering for ascending pages", () => {
    const cursor = { activityId: "b", startsAt: new Date("2026-02-02T10:00:00.000Z") };
    const next = { activityId: "c", startsAt: new Date("2026-02-03T10:00:00.000Z") };
    expect(rowAfterCursor(next, cursor, true)).toBe(true);
    expect(rowAfterCursor(cursor, cursor, true)).toBe(false);
    expect(compareInventoryDesc(next, cursor)).toBeLessThan(0);
  });
});
