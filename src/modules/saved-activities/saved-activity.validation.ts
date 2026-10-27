import { z } from "zod";

export const SAVED_ACTIVITY_LIST_DEFAULT_LIMIT = 20;
export const SAVED_ACTIVITY_LIST_MAX_LIMIT = 50;

export const savedActivityListQuerySchema = z
  .object({
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(SAVED_ACTIVITY_LIST_MAX_LIMIT).optional(),
  })
  .strict();

export type SavedActivityListQuery = z.infer<typeof savedActivityListQuerySchema>;

export const savedActivityIdParamSchema = z
  .object({
    activityId: z.string().uuid(),
  })
  .strict();
