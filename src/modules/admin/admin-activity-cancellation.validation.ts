import { z } from "zod";
import { ADMIN_ACTIVITY_CANCEL_REASON_CODES } from "./admin-activity-cancellation-reason-codes.js";

const expectedActivityStatusSchema = z
  .enum(["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"])
  .optional();

export const adminActivityCancelBodySchema = z
  .object({
    confirmation: z.literal("CANCEL"),
    reasonCode: z.enum(ADMIN_ACTIVITY_CANCEL_REASON_CODES),
    reason: z.string().trim().min(8).max(500),
    expectedStatus: expectedActivityStatusSchema,
  })
  .strict();

export const adminActivityCancelIdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/);
