import { describe, expect, it } from "vitest";
import {
  buildIdentityReviewExportCsv,
  escapeCsvCell,
  IDENTITY_REVIEW_EXPORT_MAX_ROWS,
} from "../../src/modules/admin/identity-admin-review-export-csv.js";

describe("identity-admin-review-export-csv", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(escapeCsvCell(`a"b,c\nd`)).toBe('"a""b,c\nd"');
  });

  it("prefixes formula-like values to prevent spreadsheet injection", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("  @SUM(A1)")).toBe("'  @SUM(A1)");
  });

  it("includes truncation notice when capped", () => {
    const csv = buildIdentityReviewExportCsv({
      truncated: true,
      rows: [
        {
          review_id: "22222222-2222-4222-8222-222222222222",
          display_name: "Test",
          masked_email: "a***@example.com",
          admin_review_status: "PENDING",
          identity_verification_status: "APPROVED",
          age_eligibility_status: "ELIGIBLE",
          provider_completed_at: "2026-09-14T14:24:00.000Z",
          account_created_at: "2026-09-12T10:00:00.000Z",
        },
      ],
    });
    expect(csv).toContain(String(IDENTITY_REVIEW_EXPORT_MAX_ROWS));
    expect(csv).toContain("review_id");
    expect(csv).toContain("a***@example.com");
  });
});
