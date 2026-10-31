import { describe, expect, it } from "vitest";
import {
  buildAdminActivitiesExportCsv,
  escapeAdminActivityCsvCell,
} from "../../src/modules/admin/admin-activities-csv.js";
import {
  formatLocationSummary,
  parseAdminActivityMonth,
  resolveActivitySchedulePhase,
  upcomingWindowEnd,
} from "../../src/modules/admin/admin-activities-presentation.js";

describe("admin-activities-presentation", () => {
  it("resolves schedule phase from start and end times", () => {
    const now = new Date("2026-10-31T12:00:00.000Z");
    expect(
      resolveActivitySchedulePhase(
        new Date("2026-11-01T12:00:00.000Z"),
        new Date("2026-11-01T14:00:00.000Z"),
        now,
      ),
    ).toBe("UPCOMING");
    expect(
      resolveActivitySchedulePhase(
        new Date("2026-10-31T11:00:00.000Z"),
        new Date("2026-10-31T14:00:00.000Z"),
        now,
      ),
    ).toBe("IN_SESSION");
    expect(
      resolveActivitySchedulePhase(
        new Date("2026-10-30T11:00:00.000Z"),
        new Date("2026-10-30T14:00:00.000Z"),
        now,
      ),
    ).toBe("ENDED");
  });

  it("parses YYYY-MM into a UTC month window", () => {
    expect(parseAdminActivityMonth("2026-10")).toEqual({
      gte: new Date("2026-10-01T00:00:00.000Z"),
      lt: new Date("2026-11-01T00:00:00.000Z"),
    });
  });

  it("rejects invalid month values", () => {
    expect(() => parseAdminActivityMonth("2026-13")).toThrow(/YYYY-MM/);
  });

  it("builds a 14-day upcoming window", () => {
    const now = new Date("2026-10-31T12:00:00.000Z");
    expect(upcomingWindowEnd(now).toISOString()).toBe("2026-11-14T12:00:00.000Z");
  });

  it("formats privacy-safe location summaries", () => {
    expect(formatLocationSummary("Miami Beach", "FL")).toBe("Miami Beach, FL");
    expect(formatLocationSummary("  Miami  ", null)).toBe("Miami");
    expect(formatLocationSummary(null, null)).toBeNull();
  });
});

describe("admin-activities-csv", () => {
  it("neutralizes formula injection and quotes commas", () => {
    expect(escapeAdminActivityCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeAdminActivityCsvCell("Ride, Coffee")).toBe('"Ride, Coffee"');
  });

  it("omits meeting instructions and raw emails from export columns", () => {
    const csv = buildAdminActivitiesExportCsv({
      rows: [
        {
          activity_id: "33333333-3333-4333-8333-333333333333",
          title: "Sunrise Ride",
          status: "PUBLISHED",
          mode: "IN_PERSON",
          audience: "PUBLIC",
          category: "Biking",
          location_summary: "Miami Beach, FL",
          venue_name: "South Pointe Park",
          starts_at: "2026-11-02T12:00:00.000Z",
          ends_at: "2026-11-02T14:00:00.000Z",
          time_zone: "America/New_York",
          capacity: "16",
          confirmed_count: "8",
          waitlisted_count: "1",
          pending_join_count: "0",
          host_user_id: "22222222-2222-4222-8222-222222222222",
          host_display_name: "Marcus Chen",
          host_masked_email: "m***@example.com",
          created_at: "2026-10-18T10:00:00.000Z",
        },
      ],
      truncated: false,
    });
    expect(csv).toContain("activity_id,title,status");
    expect(csv).toContain("m***@example.com");
    expect(csv).not.toContain("meetingInstructions");
    expect(csv).not.toContain("virtualMeetingDetails");
    expect(csv).not.toContain("coverStorageKey");
  });
});
