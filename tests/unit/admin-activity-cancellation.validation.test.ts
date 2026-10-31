import { describe, expect, it } from "vitest";
import { adminActivityCancelBodySchema } from "../../src/modules/admin/admin-activity-cancellation.validation.js";

describe("admin activity cancellation validation", () => {
  it("requires documented cancel confirmation and reason", () => {
    expect(() =>
      adminActivityCancelBodySchema.parse({
        reasonCode: "POLICY_VIOLATION",
        reason: "Listing violates community safety rules.",
      }),
    ).toThrow();

    expect(() =>
      adminActivityCancelBodySchema.parse({
        confirmation: "CANCEL",
        reasonCode: "UNKNOWN",
        reason: "Listing violates community safety rules.",
      }),
    ).toThrow();

    expect(
      adminActivityCancelBodySchema.parse({
        confirmation: "CANCEL",
        reasonCode: "SAFETY",
        reason: "Listing violates community safety rules.",
        expectedStatus: "PUBLISHED",
      }),
    ).toEqual({
      confirmation: "CANCEL",
      reasonCode: "SAFETY",
      reason: "Listing violates community safety rules.",
      expectedStatus: "PUBLISHED",
    });
  });

  it("rejects short reasons and invented confirmations", () => {
    expect(() =>
      adminActivityCancelBodySchema.parse({
        confirmation: "CANCEL",
        reasonCode: "OTHER",
        reason: "short",
      }),
    ).toThrow();
    expect(() =>
      adminActivityCancelBodySchema.parse({
        confirmation: "SUSPEND",
        reasonCode: "OTHER",
        reason: "Documented owner request to cancel.",
      }),
    ).toThrow();
  });
});
