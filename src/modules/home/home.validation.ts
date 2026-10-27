import { z } from "zod";

export const communityFeedQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  groupId: z.string().uuid().optional(),
});

export type CommunityFeedQuery = z.infer<typeof communityFeedQuerySchema>;
