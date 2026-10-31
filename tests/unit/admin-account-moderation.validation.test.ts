import { describe, expect, it } from "vitest";
import {
  adminAccountRestoreBodySchema,
  adminAccountSuspendBodySchema,
} from "../../src/modules/admin/admin-account-moderation.validation.js";

describe("admin account moderation validation", () => {
  it("requires documented suspend confirmation and reason", () => {
    expect(() =>
      adminAccountSuspendBodySchema.parse({
        reasonCode: "POLICY_VIOLATION",
        reason: "Repeated community guideline violations.",
      }),
    ).toThrow();

    expect(() =>
      adminAccountSuspendBodySchema.parse({
        confirmation: "SUSPEND",
        reasonCode: "POLICY_INELIGIBLE",
        reason: "Repeated community guideline violations.",
      }),
    ).toThrow();

    expect(
      adminAccountSuspendBodySchema.parse({
        confirmation: "SUSPEND",
        reasonCode: "POLICY_VIOLATION",
        reason: "Repeated community guideline violations.",
        expectedAccountStatus: "ACTIVE",
      }),
    ).toEqual({
      confirmation: "SUSPEND",
      reasonCode: "POLICY_VIOLATION",
      reason: "Repeated community guideline violations.",
      expectedAccountStatus: "ACTIVE",
    });
  });

  it("requires restore confirmation and rejects suspend confirmation", () => {
    expect(() => adminAccountRestoreBodySchema.parse({ confirmation: "SUSPEND" })).toThrow();
    expect(adminAccountRestoreBodySchema.parse({ confirmation: "RESTORE" })).toEqual({
      confirmation: "RESTORE",
    });
  });
});
