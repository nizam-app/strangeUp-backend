import { describe, expect, it } from "vitest";
import {
  decodeDecisionsCursor,
  encodeDecisionsCursor,
} from "../../src/modules/admin/identity-admin-review-decisions-cursor.js";

describe("identity-admin-review-decisions-cursor", () => {
  it("round-trips createdAt and decisionId", () => {
    const createdAt = new Date("2026-09-15T12:00:00.000Z");
    const decisionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const cursor = encodeDecisionsCursor({ createdAt, decisionId });
    const decoded = decodeDecisionsCursor(cursor);
    expect(decoded?.decisionId).toBe(decisionId);
    expect(decoded?.createdAt.toISOString()).toBe(createdAt.toISOString());
  });

  it("returns null for empty cursor", () => {
    expect(decodeDecisionsCursor(undefined)).toBeNull();
  });
});
