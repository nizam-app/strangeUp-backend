import { describe, expect, it } from "vitest";
import { resolveIdentityReviewListPresentation } from "../../src/modules/admin/identity-admin-review-list-presenter.js";

describe("identity-admin-review-list-presenter", () => {
  it("labels manual IN_REVIEW as Identity Review Required", () => {
    const updatedAt = new Date("2026-10-30T12:00:00.000Z");
    const result = resolveIdentityReviewListPresentation({
      adminReviewStatus: "NOT_READY",
      session: {
        provider: "MANUAL",
        status: "IN_REVIEW",
        completedAt: null,
        updatedAt,
      },
    });
    expect(result.pendingReviewStage).toBe("MANUAL_IDENTITY");
    expect(result.pendingReviewLabel).toBe("Identity Review Required");
    expect(result.submittedAt).toEqual(updatedAt);
  });

  it("labels platform pending activation after identity approval", () => {
    const completedAt = new Date("2026-10-29T08:00:00.000Z");
    const result = resolveIdentityReviewListPresentation({
      adminReviewStatus: "PENDING",
      session: {
        provider: "VERIFF",
        status: "APPROVED",
        completedAt,
        updatedAt: completedAt,
      },
    });
    expect(result.pendingReviewStage).toBe("PLATFORM_ACTIVATION");
    expect(result.pendingReviewLabel).toBe("Platform / Home access");
    expect(result.submittedAt).toEqual(completedAt);
  });
});
