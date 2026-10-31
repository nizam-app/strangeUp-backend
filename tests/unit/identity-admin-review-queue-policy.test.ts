import { describe, expect, it } from "vitest";
import { AppError } from "../../src/common/errors/app-error.js";
import {
  assertNotesAllowedForStatus,
  assertNotSelfReview,
  pendingTabAdminReviewStatuses,
} from "../../src/modules/admin/identity-admin-review-queue-policy.js";

describe("identity-admin-review-queue-policy", () => {
  it("lists pending tab statuses by posture", () => {
    expect(pendingTabAdminReviewStatuses("all")).toEqual(["PENDING", "NEEDS_FURTHER_REVIEW"]);
    expect(pendingTabAdminReviewStatuses("actionable")).toEqual(["PENDING"]);
    expect(pendingTabAdminReviewStatuses("on_hold")).toEqual(["NEEDS_FURTHER_REVIEW"]);
  });

  it("denies self-review", () => {
    expect(() => assertNotSelfReview("same-id", "same-id")).toThrow(AppError);
  });

  it("blocks notes on terminal statuses", () => {
    expect(() => assertNotesAllowedForStatus("APPROVED")).toThrow(/finalized/);
    expect(() => assertNotesAllowedForStatus("REJECTED")).toThrow(/finalized/);
  });
});
