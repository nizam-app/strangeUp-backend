import { describe, expect, it } from "vitest";
import { AppError } from "../../src/common/errors/app-error.js";
import {
  assertIdempotencyDecisionMatchesRequest,
  assertNoCrossContextClientHeaderReuse,
  parseScopedIdentityAdminReviewIdempotencyKey,
  scopeIdentityAdminReviewIdempotencyKey,
} from "../../src/modules/admin/identity-admin-review-idempotency.js";

const reviewerUserId = "11111111-1111-4111-8111-111111111111";
const otherReviewerUserId = "44444444-4444-4444-8444-444444444444";
const reviewIdA = "22222222-2222-4222-8222-222222222222";
const reviewIdB = "33333333-3333-4333-8333-333333333333";
const headerKey = "client-key-abc";

function scoped(input: {
  reviewId: string;
  action: "approve" | "reject" | "needs_further_review" | "return_to_pending";
  reasonCode?: string;
  optionalNote?: string;
  reviewerUserId?: string;
}): string {
  return scopeIdentityAdminReviewIdempotencyKey({
    reviewerUserId: input.reviewerUserId ?? reviewerUserId,
    reviewId: input.reviewId,
    action: input.action,
    headerKey,
    reasonCode: input.reasonCode,
    optionalNote: input.optionalNote,
  });
}

describe("identity-admin-review-idempotency", () => {
  it("scopes keys by reviewer, review, action, and reject reason", () => {
    const approve = scoped({ reviewId: reviewIdA, action: "approve" });
    const reject = scoped({
      reviewId: reviewIdA,
      action: "reject",
      reasonCode: "POLICY_INELIGIBLE",
    });
    const otherReview = scoped({ reviewId: reviewIdB, action: "approve" });

    expect(approve).not.toBe(reject);
    expect(approve).not.toBe(otherReview);
    expect(parseScopedIdentityAdminReviewIdempotencyKey(approve)?.clientHeader).toBe(headerKey);
  });

  it("binds hold/return optional notes into scoped keys", () => {
    const withNote = scoped({
      reviewId: reviewIdA,
      action: "needs_further_review",
      optionalNote: "Needs senior review.",
    });
    const otherNote = scoped({
      reviewId: reviewIdA,
      action: "needs_further_review",
      optionalNote: "Different note.",
    });
    const emptyNote = scoped({ reviewId: reviewIdA, action: "needs_further_review" });

    expect(withNote).not.toBe(otherNote);
    expect(withNote).not.toBe(emptyNote);
  });

  it("allows exact scoped retry without cross-context conflict", () => {
    const key = scoped({ reviewId: reviewIdA, action: "approve" });
    expect(() =>
      assertNoCrossContextClientHeaderReuse(
        [
          {
            userId: reviewIdA,
            status: "APPROVED",
            reasonCode: null,
            reviewerUserId,
            idempotencyKey: key,
          },
        ],
        {
          scopedKey: key,
          reviewId: reviewIdA,
          reviewerUserId,
          action: "approve",
          headerKey,
        },
      ),
    ).not.toThrow();
  });

  it("409 for same raw header on a different review (scoped persistence)", () => {
    const priorKey = scoped({ reviewId: reviewIdA, action: "approve" });
    const nextKey = scoped({ reviewId: reviewIdB, action: "approve" });

    expect(() =>
      assertNoCrossContextClientHeaderReuse(
        [
          {
            userId: reviewIdA,
            status: "APPROVED",
            reasonCode: null,
            reviewerUserId,
            idempotencyKey: priorKey,
          },
        ],
        {
          scopedKey: nextKey,
          reviewId: reviewIdB,
          reviewerUserId,
          action: "approve",
          headerKey,
        },
      ),
    ).toThrow(AppError);
  });

  it("409 for same raw header with a different action on the same review", () => {
    const approveKey = scoped({ reviewId: reviewIdA, action: "approve" });
    const rejectKey = scoped({
      reviewId: reviewIdA,
      action: "reject",
      reasonCode: "POLICY_INELIGIBLE",
    });

    expect(() =>
      assertNoCrossContextClientHeaderReuse(
        [
          {
            userId: reviewIdA,
            status: "APPROVED",
            reasonCode: null,
            reviewerUserId,
            idempotencyKey: approveKey,
          },
        ],
        {
          scopedKey: rejectKey,
          reviewId: reviewIdA,
          reviewerUserId,
          action: "reject",
          reasonCode: "POLICY_INELIGIBLE",
          headerKey,
        },
      ),
    ).toThrow(AppError);
  });

  it("409 for changed reject reason with the same raw header", () => {
    const first = scoped({
      reviewId: reviewIdA,
      action: "reject",
      reasonCode: "POLICY_INELIGIBLE",
    });
    const second = scoped({
      reviewId: reviewIdA,
      action: "reject",
      reasonCode: "FRAUD_SUSPECTED",
    });

    expect(() =>
      assertNoCrossContextClientHeaderReuse(
        [
          {
            userId: reviewIdA,
            status: "REJECTED",
            reasonCode: "POLICY_INELIGIBLE",
            reviewerUserId,
            idempotencyKey: first,
          },
        ],
        {
          scopedKey: second,
          reviewId: reviewIdA,
          reviewerUserId,
          action: "reject",
          reasonCode: "FRAUD_SUSPECTED",
          headerKey,
        },
      ),
    ).toThrow(AppError);
  });

  it("409 for changed hold optionalNote with the same raw header", () => {
    const first = scoped({
      reviewId: reviewIdA,
      action: "needs_further_review",
      optionalNote: "First note.",
    });
    const second = scoped({
      reviewId: reviewIdA,
      action: "needs_further_review",
      optionalNote: "Second note.",
    });

    expect(() =>
      assertNoCrossContextClientHeaderReuse(
        [
          {
            userId: reviewIdA,
            status: "NEEDS_FURTHER_REVIEW",
            reasonCode: null,
            reviewerUserId,
            idempotencyKey: first,
          },
        ],
        {
          scopedKey: second,
          reviewId: reviewIdA,
          reviewerUserId,
          action: "needs_further_review",
          optionalNote: "Second note.",
          headerKey,
        },
      ),
    ).toThrow(AppError);
  });

  it("allows the same raw header for a different authenticated reviewer", () => {
    const reviewerAKey = scoped({ reviewId: reviewIdA, action: "approve" });
    const reviewerBKey = scoped({
      reviewId: reviewIdA,
      action: "approve",
      reviewerUserId: otherReviewerUserId,
    });

    expect(() =>
      assertNoCrossContextClientHeaderReuse(
        [
          {
            userId: reviewIdA,
            status: "APPROVED",
            reasonCode: null,
            reviewerUserId,
            idempotencyKey: reviewerAKey,
          },
        ],
        {
          scopedKey: reviewerBKey,
          reviewId: reviewIdA,
          reviewerUserId: otherReviewerUserId,
          action: "approve",
          headerKey,
        },
      ),
    ).not.toThrow();
  });

  it("rejects cross-review legacy rows without leaking applicant context in message", () => {
    try {
      assertIdempotencyDecisionMatchesRequest(
        {
          userId: reviewIdA,
          status: "APPROVED",
          reasonCode: null,
          reviewerUserId,
          idempotencyKey: headerKey,
        },
        {
          reviewId: reviewIdB,
          reviewerUserId,
          action: "approve",
          headerKey,
        },
      );
      expect.fail("expected conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.statusCode).toBe(409);
      expect(appError.message).toBe("Idempotency key reused with different payload");
      expect(appError.message).not.toContain(reviewIdA);
    }
  });

  it("rejects mismatched action on the same legacy header key", () => {
    expect(() =>
      assertIdempotencyDecisionMatchesRequest(
        {
          userId: reviewIdA,
          status: "APPROVED",
          reasonCode: null,
          reviewerUserId,
          idempotencyKey: headerKey,
        },
        {
          reviewId: reviewIdA,
          reviewerUserId,
          action: "reject",
          reasonCode: "POLICY_INELIGIBLE",
          headerKey,
        },
      ),
    ).toThrow(AppError);
  });

  it("409 when legacy unscoped row is reused with a mismatched review via cross-context guard", () => {
    expect(() =>
      assertNoCrossContextClientHeaderReuse(
        [
          {
            userId: reviewIdA,
            status: "APPROVED",
            reasonCode: null,
            reviewerUserId,
            idempotencyKey: headerKey,
          },
        ],
        {
          scopedKey: scoped({ reviewId: reviewIdB, action: "approve" }),
          reviewId: reviewIdB,
          reviewerUserId,
          action: "approve",
          headerKey,
        },
      ),
    ).toThrow(AppError);
  });
});
