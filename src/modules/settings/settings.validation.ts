import { z } from "zod";

export const sessionIdParamSchema = z
  .object({
    sessionId: z.string().uuid(),
  })
  .strict();

export const emailChangeRequestSchema = z
  .object({
    newEmail: z.string().trim().email().max(320),
    currentPassword: z.string().min(1).max(128),
  })
  .strict();

export const emailChangeConfirmSchema = z
  .object({
    token: z.string().min(1).max(512),
  })
  .strict();
