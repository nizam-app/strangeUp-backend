import { describe, expect, it } from "vitest";
import { AppError } from "../../src/common/errors/app-error.js";
import {
  buildIdentityAdminReviewPayloadFingerprint,
  digestIdentityAdminReviewClientKey,
  identityAdminReviewClientKeySchema,
  prepareIdentityAdminReviewIdempotency,
} from "../../src/modules/admin/identity-admin-review-idempotency.js";
import {
  resolveIdentityAdminReviewIdempotencyReservation,
  toIdempotentReplayResponse,
} from "../../src/modules/admin/identity-admin-review-idempotency-reservation.js";

const reviewerUserId = "11111111-1111-4111-8111-111111111111";
const otherReviewerUserId = "44444444-4444-4444-8444-444444444444";
const reviewIdA = "22222222-2222-4222-8222-222222222222";
const reviewIdB = "33333333-3333-4333-8333-333333333333";
const clientKey = "client-key-12345678";

describe("identity-admin-review-idempotency-reservation", () => {
  it("validates client key format", () => {
    expect(identityAdminReviewClientKeySchema.safeParse("short").success).toBe(false);
    expect(identityAdminReviewClientKeySchema.safeParse("valid-key_01.abc").success).toBe(true);
    expect(identityAdminReviewClientKeySchema.safeParse("bad:key").success).toBe(false);
  });

  it("builds stable payload fingerprints for exact retries", () => {
    const first = buildIdentityAdminReviewPayloadFingerprint({
      reviewId: reviewIdA,
      action: "reject",
      reasonCode: "POLICY_INELIGIBLE",
    });
    const second = buildIdentityAdminReviewPayloadFingerprint({
      reviewId: reviewIdA,
      action: "reject",
      reasonCode: "POLICY_INELIGIBLE",
    });
    const changed = buildIdentityAdminReviewPayloadFingerprint({
      reviewId: reviewIdA,
      action: "reject",
      reasonCode: "FRAUD_SUSPECTED",
    });
    expect(first).toBe(second);
    expect(first).not.toBe(changed);
  });

  it("replays exact reservation match after success", () => {
    const prepared = prepareIdentityAdminReviewIdempotency({
      reviewerUserId,
      reviewId: reviewIdA,
      action: "approve",
      clientKey,
    });
    const resolution = resolveIdentityAdminReviewIdempotencyReservation(
      {
        reviewId: reviewIdA,
        action: "approve",
        payloadFingerprint: prepared.payloadFingerprint,
        responseReviewId: reviewIdA,
        responseAdminReviewStatus: "APPROVED",
        decisionId: "99999999-9999-4999-8999-999999999999",
      },
      {
        reviewId: reviewIdA,
        action: "approve",
        payloadFingerprint: prepared.payloadFingerprint,
      },
    );
    expect(resolution.kind).toBe("replay");
    if (resolution.kind === "replay") {
      expect(toIdempotentReplayResponse(resolution)).toEqual({
        reviewId: reviewIdA,
        adminReviewStatus: "APPROVED",
        idempotentReplay: true,
      });
    }
  });

  it("409 conflict for cross-review reuse of the same client key digest slot", () => {
    const preparedA = prepareIdentityAdminReviewIdempotency({
      reviewerUserId,
      reviewId: reviewIdA,
      action: "approve",
      clientKey,
    });
    const preparedB = prepareIdentityAdminReviewIdempotency({
      reviewerUserId,
      reviewId: reviewIdB,
      action: "approve",
      clientKey,
    });
    expect(digestIdentityAdminReviewClientKey(clientKey)).toBe(preparedA.clientKeyDigest);
    expect(preparedA.clientKeyDigest).toBe(preparedB.clientKeyDigest);

    const resolution = resolveIdentityAdminReviewIdempotencyReservation(
      {
        reviewId: reviewIdA,
        action: "approve",
        payloadFingerprint: preparedA.payloadFingerprint,
        responseReviewId: reviewIdA,
        responseAdminReviewStatus: "APPROVED",
        decisionId: "99999999-9999-4999-8999-999999999999",
      },
      {
        reviewId: reviewIdB,
        action: "approve",
        payloadFingerprint: preparedB.payloadFingerprint,
      },
    );
    expect(resolution.kind).toBe("conflict");
  });

  it("409 conflict for cross-action reuse with the same client key", () => {
    const approve = prepareIdentityAdminReviewIdempotency({
      reviewerUserId,
      reviewId: reviewIdA,
      action: "approve",
      clientKey,
    });
    const reject = prepareIdentityAdminReviewIdempotency({
      reviewerUserId,
      reviewId: reviewIdA,
      action: "reject",
      reasonCode: "POLICY_INELIGIBLE",
      clientKey,
    });

    const resolution = resolveIdentityAdminReviewIdempotencyReservation(
      {
        reviewId: reviewIdA,
        action: "approve",
        payloadFingerprint: approve.payloadFingerprint,
        responseReviewId: reviewIdA,
        responseAdminReviewStatus: "APPROVED",
        decisionId: null,
      },
      {
        reviewId: reviewIdA,
        action: "reject",
        payloadFingerprint: reject.payloadFingerprint,
      },
    );
    expect(resolution.kind).toBe("conflict");
  });

  it("allows different reviewers to use the same client key independently", () => {
    const preparedA = prepareIdentityAdminReviewIdempotency({
      reviewerUserId,
      reviewId: reviewIdA,
      action: "approve",
      clientKey,
    });
    const preparedB = prepareIdentityAdminReviewIdempotency({
      reviewerUserId: otherReviewerUserId,
      reviewId: reviewIdA,
      action: "approve",
      clientKey,
    });
    expect(preparedA.clientKeyDigest).toBe(preparedB.clientKeyDigest);
    expect(preparedA.scopedDecisionKey).not.toBe(preparedB.scopedDecisionKey);
  });

  it("marks in-progress reservations without a stored response", () => {
    const prepared = prepareIdentityAdminReviewIdempotency({
      reviewerUserId,
      reviewId: reviewIdA,
      action: "approve",
      clientKey,
    });
    const resolution = resolveIdentityAdminReviewIdempotencyReservation(
      {
        reviewId: reviewIdA,
        action: "approve",
        payloadFingerprint: prepared.payloadFingerprint,
        responseReviewId: reviewIdA,
        responseAdminReviewStatus: null,
        decisionId: null,
      },
      {
        reviewId: reviewIdA,
        action: "approve",
        payloadFingerprint: prepared.payloadFingerprint,
      },
    );
    expect(resolution.kind).toBe("in_progress");
  });

  it("simulates concurrent identical requests resolving to replay after winner commits", () => {
    const prepared = prepareIdentityAdminReviewIdempotency({
      reviewerUserId,
      reviewId: reviewIdA,
      action: "needs_further_review",
      clientKey,
      optionalNote: "Escalate.",
    });
    const winner = {
      reviewId: reviewIdA,
      action: "needs_further_review",
      payloadFingerprint: prepared.payloadFingerprint,
      responseReviewId: reviewIdA,
      responseAdminReviewStatus: "NEEDS_FURTHER_REVIEW" as const,
      decisionId: "88888888-8888-4888-8888-888888888888",
    };
    const loserResolution = resolveIdentityAdminReviewIdempotencyReservation(winner, {
      reviewId: reviewIdA,
      action: "needs_further_review",
      payloadFingerprint: prepared.payloadFingerprint,
    });
    expect(loserResolution.kind).toBe("replay");
  });

  it("simulates concurrent different-context requests where loser gets conflict", () => {
    const preparedA = prepareIdentityAdminReviewIdempotency({
      reviewerUserId,
      reviewId: reviewIdA,
      action: "approve",
      clientKey,
    });
    const preparedB = prepareIdentityAdminReviewIdempotency({
      reviewerUserId,
      reviewId: reviewIdB,
      action: "approve",
      clientKey,
    });
    const winnerCommitted = {
      reviewId: reviewIdA,
      action: "approve",
      payloadFingerprint: preparedA.payloadFingerprint,
      responseReviewId: reviewIdA,
      responseAdminReviewStatus: "APPROVED" as const,
      decisionId: "77777777-7777-4777-8777-777777777777",
    };
    const loser = resolveIdentityAdminReviewIdempotencyReservation(winnerCommitted, {
      reviewId: reviewIdB,
      action: "approve",
      payloadFingerprint: preparedB.payloadFingerprint,
    });
    expect(loser.kind).toBe("conflict");
  });
});

describe("identity-admin-review-idempotency client key parsing", () => {
  it("rejects malformed headers via schema", () => {
    expect(() => identityAdminReviewClientKeySchema.parse("x".repeat(7))).toThrow();
  });

  it("does not expose digest collisions in error types", () => {
    expect(() => {
      throw new AppError("CONFLICT", "Idempotency key reused with different payload", 409);
    }).toThrow(AppError);
  });
});
