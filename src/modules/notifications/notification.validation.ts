import { z } from "zod";

export const notificationListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const notificationIdParamSchema = z.object({
  notificationId: z.string().uuid(),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
