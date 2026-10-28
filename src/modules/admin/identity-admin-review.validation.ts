import { z } from "zod";
import { ADMIN_IDENTITY_REVIEW_REJECT_REASON_CODES } from "./admin-review-reason-codes.js";

export const identityReviewListQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export const identityReviewRejectBodySchema = z.object({
  reasonCode: z.enum(ADMIN_IDENTITY_REVIEW_REJECT_REASON_CODES),
});
