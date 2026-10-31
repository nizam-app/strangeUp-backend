import { z } from "zod";
import { ADMIN_IDENTITY_REVIEW_REJECT_REASON_CODES } from "./admin-review-reason-codes.js";

const calendarDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const identityReviewListQuerySchema = z
  .object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
    posture: z.enum(["all", "actionable", "on_hold"]).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/, "Invalid cursor format")
      .optional(),
    q: z.string().trim().max(120).optional(),
    submittedFrom: calendarDateSchema.optional(),
    submittedTo: calendarDateSchema.optional(),
    identityVerificationStatus: z
      .enum(["NOT_STARTED", "PENDING", "APPROVED", "REJECTED", "EXPIRED", "REVOKED"])
      .optional(),
  })
  .strict();

export const identityReviewSummaryQuerySchema = z.object({}).strict();

export const identityReviewExportQuerySchema = identityReviewListQuerySchema.omit({
  limit: true,
  cursor: true,
});

export const identityReviewRejectBodySchema = z.object({
  reasonCode: z.enum(ADMIN_IDENTITY_REVIEW_REJECT_REASON_CODES),
});
