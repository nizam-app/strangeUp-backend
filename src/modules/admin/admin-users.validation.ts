import { z } from "zod";

export const adminUsersListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/, "Invalid cursor format")
      .optional(),
    q: z.string().trim().max(120).optional(),
    accountStatus: z.enum(["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DELETED"]).optional(),
    identityVerificationStatus: z
      .enum(["NOT_STARTED", "PENDING", "APPROVED", "REJECTED", "EXPIRED", "REVOKED"])
      .optional(),
    adminReviewStatus: z
      .enum([
        "NOT_READY",
        "PENDING",
        "NEEDS_FURTHER_REVIEW",
        "APPROVED",
        "REJECTED",
        "NEEDS_MORE_INFO",
      ])
      .optional(),
  })
  .strict();

export const adminUsersSummaryQuerySchema = z.object({}).strict();

export const adminUsersUserIdParamsSchema = z
  .object({
    userId: z.string().uuid(),
  })
  .strict();
