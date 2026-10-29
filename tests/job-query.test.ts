import { describe, expect, it } from "vitest";
import { buildPublishedJobListWhere } from "../src/modules/jobs/job-query.js";

describe("job discovery query (029F)", () => {
  it("combines text search and cursor pagination with AND (not overlapping OR)", () => {
    const where = buildPublishedJobListWhere({
      query: { limit: 20, q: "coach", employmentType: "FULL_TIME" },
      cursor: { createdAt: "2026-01-01T00:00:00.000Z", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    });
    expect(where.status).toBe("PUBLISHED");
    expect(where.closedAt).toBeNull();
    expect(where.employmentType).toBe("FULL_TIME");
    const andClause = where.AND;
    expect(Array.isArray(andClause)).toBe(true);
    if (!Array.isArray(andClause)) {
      throw new Error("expected AND array");
    }
    expect(andClause).toHaveLength(2);
    expect(andClause[0]).toHaveProperty("OR");
    expect(andClause[1]).toHaveProperty("OR");
  });

  it("does not emit distance, featured, or applicant fields", () => {
    const where = buildPublishedJobListWhere({ query: { limit: 20 }, cursor: null });
    expect(JSON.stringify(where)).not.toMatch(/distance|featured|applicant|radius/i);
  });
});
