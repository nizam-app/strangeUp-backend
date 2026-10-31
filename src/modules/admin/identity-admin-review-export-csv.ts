/** Maximum rows per export request (Task 031H-1). */
export const IDENTITY_REVIEW_EXPORT_MAX_ROWS = 1000;

export const IDENTITY_REVIEW_EXPORT_CSV_COLUMNS = [
  "review_id",
  "display_name",
  "masked_email",
  "admin_review_status",
  "identity_verification_status",
  "age_eligibility_status",
  "provider_completed_at",
  "account_created_at",
] as const;

export type IdentityReviewExportCsvRow = Record<
  (typeof IDENTITY_REVIEW_EXPORT_CSV_COLUMNS)[number],
  string
>;

const FORMULA_PREFIX = /^[\s\t\r\n]*[=+\-@]/;

/** Escape CSV cell and neutralize spreadsheet formula injection. */
export function escapeCsvCell(value: string): string {
  let safe = value;
  if (FORMULA_PREFIX.test(safe)) {
    safe = `'${safe}`;
  }
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildIdentityReviewExportCsv(input: {
  rows: IdentityReviewExportCsvRow[];
  truncated: boolean;
}): string {
  const lines: string[] = [];
  if (input.truncated) {
    lines.push(
      escapeCsvCell(
        `# Export capped at ${IDENTITY_REVIEW_EXPORT_MAX_ROWS} rows; additional matching rows were omitted.`,
      ),
    );
  }
  lines.push(IDENTITY_REVIEW_EXPORT_CSV_COLUMNS.join(","));
  for (const row of input.rows) {
    lines.push(
      IDENTITY_REVIEW_EXPORT_CSV_COLUMNS.map((col) => escapeCsvCell(row[col] ?? "")).join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function buildIdentityReviewExportFilename(status: string): string {
  const safeStatus = status.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "export";
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `identity-reviews-${safeStatus}-${stamp}.csv`;
}
