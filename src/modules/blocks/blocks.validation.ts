import { z } from "zod";

const uuidSchema = z.string().uuid();

export const blockUserBodySchema = z
  .object({
    targetUserId: uuidSchema,
  })
  .strict();

export const blockTargetParamSchema = z.object({
  targetUserId: uuidSchema,
});

export const listBlocksQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).optional(),
  })
  .strict();
