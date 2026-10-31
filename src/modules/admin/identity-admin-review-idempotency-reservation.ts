import type { StrangeUpAdminReviewStatus } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import {
  IDENTITY_ADMIN_REVIEW_IDEMPOTENCY_CONFLICT_MESSAGE,
  type IdentityAdminReviewIdempotencyAction,
} from "./identity-admin-review-idempotency.js";

export type IdentityAdminReviewIdempotencyReservationSnapshot = {
  reviewId: string;
  action: string;
  payloadFingerprint: string;
  responseReviewId: string;
  responseAdminReviewStatus: StrangeUpAdminReviewStatus | null;
  decisionId: string | null;
};

export type IdentityAdminReviewIdempotencyReservationExpectation = {
  reviewId: string;
  action: IdentityAdminReviewIdempotencyAction;
  payloadFingerprint: string;
};

export type IdentityAdminReviewIdempotencyReservationResolution =
  | {
      kind: "replay";
      responseReviewId: string;
      responseAdminReviewStatus: StrangeUpAdminReviewStatus;
    }
  | { kind: "conflict" }
  | { kind: "in_progress" };

export function resolveIdentityAdminReviewIdempotencyReservation(
  existing: IdentityAdminReviewIdempotencyReservationSnapshot,
  expected: IdentityAdminReviewIdempotencyReservationExpectation,
): IdentityAdminReviewIdempotencyReservationResolution {
  if (existing.payloadFingerprint !== expected.payloadFingerprint) {
    return { kind: "conflict" };
  }
  if (existing.reviewId !== expected.reviewId || existing.action !== expected.action) {
    return { kind: "conflict" };
  }

  if (existing.responseAdminReviewStatus && existing.responseReviewId) {
    return {
      kind: "replay",
      responseReviewId: existing.responseReviewId,
      responseAdminReviewStatus: existing.responseAdminReviewStatus,
    };
  }

  return { kind: "in_progress" };
}

export function toIdempotentReplayResponse(
  resolution: Extract<IdentityAdminReviewIdempotencyReservationResolution, { kind: "replay" }>,
): {
  reviewId: string;
  adminReviewStatus: StrangeUpAdminReviewStatus;
  idempotentReplay: true;
} {
  return {
    reviewId: resolution.responseReviewId,
    adminReviewStatus: resolution.responseAdminReviewStatus,
    idempotentReplay: true as const,
  };
}

export function throwIdempotencyReservationConflict(): never {
  throw new AppError("CONFLICT", IDENTITY_ADMIN_REVIEW_IDEMPOTENCY_CONFLICT_MESSAGE, 409);
}

export function throwIdempotencyReservationInProgress(): never {
  throw new AppError(
    "CONFLICT",
    "An idempotent identity review request is already in progress",
    409,
  );
}
