import { z } from "zod";

export const patchNotificationPreferenceBodySchema = z
  .object({
    pushEnabled: z.boolean().optional(),
    directMessagesEnabled: z.boolean().optional(),
    messageRequestsEnabled: z.boolean().optional(),
    groupMembershipEnabled: z.boolean().optional(),
    groupChatEnabled: z.boolean().optional(),
    activityUpdatesEnabled: z.boolean().optional(),
    marketingEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one preference field is required",
  });
