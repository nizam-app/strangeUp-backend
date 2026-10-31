import { describe, expect, it } from "vitest";
import {
  buildDashboardExportCsv,
  buildDashboardExportFilename,
} from "../../src/modules/admin/admin-dashboard-export.js";

describe("admin-dashboard-export", () => {
  it("builds a formula-safe metrics CSV without Figma sample numbers", () => {
    const csv = buildDashboardExportCsv([
      {
        section: "kpi",
        metric: "total_users",
        label: "Total Users",
        value: "12",
        status: "available",
        definition: "Count of registered users with deletedAt IS NULL.",
        period: "Last 30 Days",
      },
      {
        section: "kpi",
        metric: "revenue",
        label: "Revenue",
        value: "",
        status: "unavailable",
        definition: "No settled payment ledger.",
        period: "Last 30 Days",
      },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("total_users");
    expect(csv).toContain("unavailable");
    expect(csv).not.toContain("48290");
    expect(csv).not.toContain("124550");
  });

  it("names export files from range and UTC date", () => {
    expect(buildDashboardExportFilename("last_30_days", new Date("2026-10-31T15:00:00.000Z"))).toBe(
      "admin-dashboard-last_30_days-20261031.csv",
    );
  });
});
