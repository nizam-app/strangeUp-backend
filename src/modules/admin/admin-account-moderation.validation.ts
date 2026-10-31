import { z } from "zod";
import { ADMIN_ACCOUNT_SUSPEND_REASON_CODES } from "./admin-account-moderation-reason-codes.js";

const expectedAccountStatusSchema = z
  .enum(["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED"])
  .optional();

export const adminAccountSuspendBodySchema = z
  .object({
    confirmation: z.literal("SUSPEND"),
    reasonCode: z.enum(ADMIN_ACCOUNT_SUSPEND_REASON_CODES),
    reason: z.string().trim().min(8).max(500),
    expectedAccountStatus: expectedAccountStatusSchema,
  })
  .strict();

export const adminAccountRestoreBodySchema = z
  .object({
    confirmation: z.literal("RESTORE"),
    reason: z.string().trim().min(8).max(500).optional(),
    expectedAccountStatus: expectedAccountStatusSchema,
  })
  .strict();

export const adminAccountModerationIdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/);
