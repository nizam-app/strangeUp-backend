import { describe, expect, it } from "vitest";
import {
  bucketStartUtc,
  countByBucket,
  enumerateBuckets,
  formatBucketLabel,
  percentChange,
  resolveDashboardRange,
  runningTotal,
  startOfUtcDay,
  startOfUtcWeek,
} from "../../src/modules/admin/admin-dashboard-range.js";

describe("admin-dashboard-range", () => {
  const now = new Date("2026-10-31T15:04:00.000Z");

  it("builds a 30-day UTC window with an equal prior period", () => {
    const range = resolveDashboardRange({ range: "last_30_days", now });
    expect(range.label).toBe("Last 30 Days");
    expect(range.timezone).toBe("UTC");
    expect(range.granularity).toBe("day");
    expect(range.from.toISOString()).toBe("2026-10-02T00:00:00.000Z");
    expect(range.previousFrom?.toISOString()).toBe("2026-09-02T00:00:00.000Z");
    expect(range.previousTo?.toISOString()).toBe("2026-10-02T00:00:00.000Z");
  });

  it("uses weekly buckets for 90 days and monthly buckets for 12 months", () => {
    expect(resolveDashboardRange({ range: "last_90_days", now }).granularity).toBe("week");
    const year = resolveDashboardRange({ range: "last_12_months", now });
    expect(year.granularity).toBe("month");
    expect(year.from.toISOString()).toBe("2025-11-01T00:00:00.000Z");
  });

  it("truncates all-time history older than 36 months", () => {
    const range = resolveDashboardRange({
      range: "all_time",
      now,
      earliestRecordAt: new Date("2020-01-15T00:00:00.000Z"),
    });
    expect(range.truncatedFromHistory).toBe(true);
    expect(range.from.toISOString()).toBe("2023-11-01T00:00:00.000Z");
    expect(range.previousFrom).toBeNull();
  });

  it("enumerates UTC day buckets and counts period signups separately from cumulative totals", () => {
    const from = startOfUtcDay(new Date("2026-10-01T12:00:00.000Z"));
    const to = new Date("2026-10-03T18:00:00.000Z");
    const buckets = enumerateBuckets({ from, to, granularity: "day" });
    expect(buckets.map((d) => d.toISOString())).toEqual([
      "2026-10-01T00:00:00.000Z",
      "2026-10-02T00:00:00.000Z",
      "2026-10-03T00:00:00.000Z",
    ]);
    const counts = countByBucket(
      [new Date("2026-10-01T01:00:00.000Z"), new Date("2026-10-03T23:00:00.000Z")],
      buckets,
      "day",
    );
    expect(counts).toEqual([1, 0, 1]);
    expect(runningTotal(10, counts)).toEqual([11, 11, 12]);
  });

  it("starts ISO weeks on Monday UTC", () => {
    const sunday = new Date("2026-10-25T12:00:00.000Z");
    expect(startOfUtcWeek(sunday).toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(bucketStartUtc(sunday, "week").toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(formatBucketLabel(new Date("2026-10-01T00:00:00.000Z"), "month")).toBe("Oct 2026");
  });

  it("computes honest percent deltas without inventing a baseline", () => {
    expect(percentChange(12, 10)).toBe(20);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(4, 0)).toBe(100);
  });
});
