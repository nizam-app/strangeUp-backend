import { describe, expect, it } from "vitest";
import { AppError } from "../../src/common/errors/app-error.js";
import {
  buildBatchBindingFingerprint,
  deriveBatchItemIdempotencyKey,
  identityReviewBatchDecideBodySchema,
  mapBatchItemError,
} from "../../src/modules/admin/identity-admin-review-batch.js";

const reviewIdA = "22222222-2222-4222-8222-222222222222";
const reviewIdB = "33333333-3333-4333-8333-333333333333";

describe("identity-admin-review-batch", () => {
  it("accepts valid approve batch payload", () => {
    const parsed = identityReviewBatchDecideBodySchema.parse({
      action: "APPROVE",
      reviewIds: [reviewIdA],
      batchRequestId: "batch-req-001",
    });
    expect(parsed.action).toBe("APPROVE");
  });

  it("requires reason on reject and forbids reason on approve", () => {
    expect(() =>
      identityReviewBatchDecideBodySchema.parse({
        action: "REJECT",
        reviewIds: [reviewIdA],
        batchRequestId: "batch-req-002",
      }),
    ).toThrow();

    expect(() =>
      identityReviewBatchDecideBodySchema.parse({
        action: "APPROVE",
        reviewIds: [reviewIdA],
        reasonCode: "OTHER_ADMIN_DECISION",
        batchRequestId: "batch-req-003",
      }),
    ).toThrow();
  });

  it("rejects duplicate review IDs and batches over 10", () => {
    const ids = Array.from(
      { length: 11 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    expect(() =>
      identityReviewBatchDecideBodySchema.parse({
        action: "APPROVE",
        reviewIds: ids,
        batchRequestId: "batch-req-004",
      }),
    ).toThrow();

    expect(() =>
      identityReviewBatchDecideBodySchema.parse({
        action: "APPROVE",
        reviewIds: [reviewIdA, reviewIdA],
        batchRequestId: "batch-req-005",
      }),
    ).toThrow();
  });

  it("changes binding fingerprint when batch membership or action changes", () => {
    const base = buildBatchBindingFingerprint({
      action: "APPROVE",
      reviewIds: [reviewIdA, reviewIdB],
    });
    const otherAction = buildBatchBindingFingerprint({
      action: "REJECT",
      reasonCode: "FRAUD_SUSPECTED",
      reviewIds: [reviewIdA, reviewIdB],
    });
    const otherSet = buildBatchBindingFingerprint({
      action: "APPROVE",
      reviewIds: [reviewIdA],
    });
    expect(base).not.toBe(otherAction);
    expect(base).not.toBe(otherSet);
  });

  it("derives distinct per-review idempotency keys bound to batch fingerprint", () => {
    const fingerprint = buildBatchBindingFingerprint({
      action: "APPROVE",
      reviewIds: [reviewIdA, reviewIdB],
    });
    const keyA = deriveBatchItemIdempotencyKey({
      batchRequestId: "batch-req-006",
      bindingFingerprint: fingerprint,
      reviewId: reviewIdA,
    });
    const keyB = deriveBatchItemIdempotencyKey({
      batchRequestId: "batch-req-006",
      bindingFingerprint: fingerprint,
      reviewId: reviewIdB,
    });
    const keyAOtherBatch = deriveBatchItemIdempotencyKey({
      batchRequestId: "batch-req-007",
      bindingFingerprint: fingerprint,
      reviewId: reviewIdA,
    });

    expect(keyA).not.toBe(keyB);
    expect(keyA).not.toBe(keyAOtherBatch);
    expect(keyA).toContain(reviewIdA);
  });

  it("maps AppError codes to batch item outcomes", () => {
    expect(mapBatchItemError(new AppError("CONFLICT", "Not pending", 409)).outcome).toBe(
      "CONFLICT",
    );
    expect(mapBatchItemError(new AppError("AUTH_FORBIDDEN", "Nope", 403)).outcome).toBe(
      "FORBIDDEN",
    );
    expect(mapBatchItemError(new AppError("NOT_FOUND", "Missing", 404)).outcome).toBe("NOT_FOUND");
  });
});
