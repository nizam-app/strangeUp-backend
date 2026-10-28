import { z } from "zod";

export const subscribeDmSchema = z.object({
  conversationId: z.string().uuid(),
});

export const subscribeGroupSchema = z.object({
  groupId: z.string().uuid(),
});

export const typingInputSchema = z.object({
  target: z.enum(["dm", "group"]),
  id: z.string().uuid(),
  active: z.boolean(),
});
