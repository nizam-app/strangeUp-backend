import { z } from "zod";

export const startVerificationSessionBodySchema = z
  .object({
    locale: z.string().trim().min(2).max(16).optional(),
  })
  .strict();

const mockWebhookVerificationSchema = z.object({
  id: z.string().min(1).max(128),
  status: z.enum([
    "approved",
    "declined",
    "resubmission_requested",
    "review",
    "expired",
    "abandoned",
  ]),
  decisionTime: z.string().datetime().optional(),
});

export const mockWebhookBodySchema = z
  .object({
    id: z.string().min(1).max(128),
    action: z.literal("verification.decision"),
    verification: mockWebhookVerificationSchema,
  })
  .strict();

export type MockWebhookBody = z.infer<typeof mockWebhookBodySchema>;
