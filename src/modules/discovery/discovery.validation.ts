import { z } from "zod";

export const discoverPeopleQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
    cursor: z.string().min(1).optional(),
    q: z.string().trim().min(1).max(80).optional(),
    city: z.string().trim().min(1).max(80).optional(),
    region: z.string().trim().min(1).max(80).optional(),
    interest: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const publicUserIdParamSchema = z.object({
  userId: z.string().uuid(),
});
