import { escapeCsvCell } from "./identity-admin-review-export-csv.js";

export const DASHBOARD_EXPORT_CSV_COLUMNS = [
  "section",
  "metric",
  "label",
  "value",
  "status",
  "definition",
  "period",
] as const;

export type DashboardExportCsvRow = Record<(typeof DASHBOARD_EXPORT_CSV_COLUMNS)[number], string>;

export function buildDashboardExportCsv(rows: DashboardExportCsvRow[]): string {
  const lines = [DASHBOARD_EXPORT_CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(DASHBOARD_EXPORT_CSV_COLUMNS.map((col) => escapeCsvCell(row[col] ?? "")).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function buildDashboardExportFilename(rangeId: string, generatedAt: Date): string {
  const stamp = generatedAt.toISOString().slice(0, 10).replace(/-/g, "");
  return `admin-dashboard-${rangeId}-${stamp}.csv`;
}
