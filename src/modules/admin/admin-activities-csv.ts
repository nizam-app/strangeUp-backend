/** Maximum rows per admin activities CSV export (Task 033B). */
export const ADMIN_ACTIVITIES_EXPORT_MAX_ROWS = 1000;

export const ADMIN_ACTIVITIES_EXPORT_CSV_COLUMNS = [
  "activity_id",
  "title",
  "status",
  "mode",
  "audience",
  "category",
  "location_summary",
  "venue_name",
  "starts_at",
  "ends_at",
  "time_zone",
  "capacity",
  "confirmed_count",
  "waitlisted_count",
  "pending_join_count",
  "host_user_id",
  "host_display_name",
  "host_masked_email",
  "created_at",
] as const;

export type AdminActivityExportCsvRow = Record<
  (typeof ADMIN_ACTIVITIES_EXPORT_CSV_COLUMNS)[number],
  string
>;

const FORMULA_PREFIX = /^[\s\t\r\n]*[=+\-@]/;

export function escapeAdminActivityCsvCell(value: string): string {
  let safe = value;
  if (FORMULA_PREFIX.test(safe)) {
    safe = `'${safe}`;
  }
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildAdminActivitiesExportCsv(input: {
  rows: AdminActivityExportCsvRow[];
  truncated: boolean;
}): string {
  const lines: string[] = [];
  if (input.truncated) {
    lines.push(
      escapeAdminActivityCsvCell(
        `# Export capped at ${ADMIN_ACTIVITIES_EXPORT_MAX_ROWS} rows; additional matching rows were omitted.`,
      ),
    );
  }
  lines.push(ADMIN_ACTIVITIES_EXPORT_CSV_COLUMNS.join(","));
  for (const row of input.rows) {
    lines.push(
      ADMIN_ACTIVITIES_EXPORT_CSV_COLUMNS.map((col) =>
        escapeAdminActivityCsvCell(row[col] ?? ""),
      ).join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function buildAdminActivitiesExportFilename(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `admin-activities-${stamp}.csv`;
}
