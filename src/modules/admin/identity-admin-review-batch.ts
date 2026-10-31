import { createHash } from "node:crypto";
import { z } from "zod";
import { isAppError } from "../../common/errors/app-error.js";
import { ADMIN_IDENTITY_REVIEW_REJECT_REASON_CODES } from "./admin-review-reason-codes.js";
import { identityAdminReviewClientKeySchema } from "./identity-admin-review-idempotency.js";

export const IDENTITY_REVIEW_BATCH_MAX_SIZE = 10;

export const identityReviewBatchDecideBodySchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"]),
    reviewIds: z
      .array(z.string().uuid())
      .min(1, "At least one review is required")
      .max(
        IDENTITY_REVIEW_BATCH_MAX_SIZE,
        `Batch cannot exceed ${IDENTITY_REVIEW_BATCH_MAX_SIZE} reviews`,
      ),
    reasonCode: z.enum(ADMIN_IDENTITY_REVIEW_REJECT_REASON_CODES).optional(),
    batchRequestId: identityAdminReviewClientKeySchema,
  })
  .strict()
  .superRefine((body, ctx) => {
    const unique = new Set(body.reviewIds);
    if (unique.size !== body.reviewIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate review IDs are not allowed in a batch",
        path: ["reviewIds"],
      });
    }
    if (body.action === "REJECT" && !body.reasonCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reasonCode is required when action is REJECT",
        path: ["reasonCode"],
      });
    }
    if (body.action === "APPROVE" && body.reasonCode !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reasonCode must not be sent for APPROVE",
        path: ["reasonCode"],
      });
    }
  });

export type IdentityReviewBatchDecideBody = z.infer<typeof identityReviewBatchDecideBodySchema>;

export function buildBatchBindingFingerprint(input: {
  action: "APPROVE" | "REJECT";
  reasonCode?: string;
  reviewIds: string[];
}): string {
  const sorted = [...new Set(input.reviewIds)].sort();
  const canonical = JSON.stringify({
    action: input.action,
    reasonCode: input.reasonCode ?? null,
    reviewIds: sorted,
  });
  return createHash("sha256").update(canonical, "utf8").digest("base64url").slice(0, 22);
}

/** Per-applicant client idempotency key — unique per reviewId; binds batch payload via fingerprint. */
export function deriveBatchItemIdempotencyKey(input: {
  batchRequestId: string;
  bindingFingerprint: string;
  reviewId: string;
}): string {
  const candidate = `${input.batchRequestId}.${input.bindingFingerprint}.${input.reviewId}`;
  const parsed = identityAdminReviewClientKeySchema.safeParse(candidate);
  if (parsed.success) {
    return parsed.data;
  }
  const digest = createHash("sha256")
    .update(`${input.batchRequestId}:${input.bindingFingerprint}:${input.reviewId}`, "utf8")
    .digest("base64url")
    .slice(0, 48);
  const fallback = `batch.${digest}.${input.reviewId}`;
  const fallbackParsed = identityAdminReviewClientKeySchema.safeParse(fallback);
  if (!fallbackParsed.success) {
    throw new Error("Unable to derive batch idempotency key");
  }
  return fallbackParsed.data;
}

export type BatchReviewItemOutcome =
  | "SUCCEEDED"
  | "FAILED"
  | "CONFLICT"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "UNAVAILABLE";

export function mapBatchItemError(err: unknown): {
  outcome: BatchReviewItemOutcome;
  message: string;
} {
  if (isAppError(err)) {
    const message = err.exposeMessage ? err.message : "Unable to complete this review decision.";
    if (err.code === "CONFLICT" || err.statusCode === 409) {
      return { outcome: "CONFLICT", message };
    }
    if (err.code === "AUTH_FORBIDDEN" || err.statusCode === 403) {
      return {
        outcome: "FORBIDDEN",
        message: "You do not have permission to review this applicant.",
      };
    }
    if (err.code === "NOT_FOUND" || err.statusCode === 404) {
      return { outcome: "NOT_FOUND", message: "Identity review not found." };
    }
    if (err.code === "VALIDATION_ERROR" || err.statusCode === 400) {
      return { outcome: "VALIDATION_ERROR", message };
    }
    if (err.statusCode === 503 || err.code === "SERVICE_UNAVAILABLE") {
      return {
        outcome: "UNAVAILABLE",
        message: "Verification service is temporarily unavailable.",
      };
    }
    return { outcome: "FAILED", message: "Unable to complete this review decision." };
  }
  return { outcome: "UNAVAILABLE", message: "Verification service is temporarily unavailable." };
}
