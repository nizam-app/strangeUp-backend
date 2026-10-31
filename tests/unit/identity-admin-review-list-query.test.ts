import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildFilterFingerprint,
  buildIdentityReviewListWhere,
  buildSearchWhere,
  parseSubmittedDateRange,
  platformPendingAdminQueueCriteria,
} from "../../src/modules/admin/identity-admin-review-list-query.js";
import { manualIdentityReviewPendingCriteria } from "../../src/modules/admin/identity-admin-review-pending-eligibility.js";

const FIXED_NOW = new Date("2026-10-31T12:00:00.000Z");

describe("identity-admin-review-list-query", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires inverted date range rejection", () => {
    expect(() => parseSubmittedDateRange("2026-09-15", "2026-09-01")).toThrowError(/submittedFrom/);
  });

  it("builds UUID search as exact id match", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    expect(buildSearchWhere(id)).toEqual({ id: id.toLowerCase() });
  });

  it("includes platform and manual identity pending eligibility for posture all", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);

    const where = buildIdentityReviewListWhere(
      { status: "PENDING", posture: "all" },
      { from: null, to: null },
    );
    expect(where.AND).toEqual(
      expect.arrayContaining([
        {
          OR: [
            {
              AND: [
                { adminReviewStatus: { in: ["PENDING", "NEEDS_FURTHER_REVIEW"] } },
                platformPendingAdminQueueCriteria(),
              ],
            },
            manualIdentityReviewPendingCriteria(),
          ],
        },
      ]),
    );
  });

  it("filters actionable pending posture with manual identity branch", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);

    const where = buildIdentityReviewListWhere(
      { status: "PENDING", posture: "actionable" },
      { from: null, to: null },
    );
    const pendingEligible = (where.AND as object[]).find(
      (part) => "OR" in (part as Record<string, unknown>),
    ) as { OR: unknown[] };
    expect(pendingEligible.OR).toEqual(
      expect.arrayContaining([
        {
          AND: [{ adminReviewStatus: "PENDING" }, platformPendingAdminQueueCriteria()],
        },
        manualIdentityReviewPendingCriteria(),
      ]),
    );
  });

  it("excludes manual identity from on-hold posture", () => {
    const where = buildIdentityReviewListWhere(
      { status: "PENDING", posture: "on_hold" },
      { from: null, to: null },
    );
    expect(where.AND).toEqual(
      expect.arrayContaining([
        {
          AND: [{ adminReviewStatus: "NEEDS_FURTHER_REVIEW" }, platformPendingAdminQueueCriteria()],
        },
      ]),
    );
    expect(JSON.stringify(where)).not.toContain("MANUAL");
  });

  it("changes filter fingerprint when search changes", () => {
    const range = { from: null, to: null };
    const a = buildFilterFingerprint({ status: "PENDING", q: "elena" }, range);
    const b = buildFilterFingerprint({ status: "PENDING", q: "julian" }, range);
    expect(a).not.toBe(b);
  });
});
