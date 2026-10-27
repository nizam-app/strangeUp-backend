import { z } from "zod";

export const FAVORITE_ACTIVITY_MAX_ITEMS = 5;
export const FAVORITE_ACTIVITY_TITLE_MAX = 80;
export const FAVORITE_ACTIVITY_NOTE_MAX = 120;

const skillLevelSchema = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
const cadenceSchema = z.enum(["WEEKLY", "CASUAL"]);

const favoriteActivityItemSchema = z
  .object({
    title: z.string().trim().min(1).max(FAVORITE_ACTIVITY_TITLE_MAX),
    skillLevel: skillLevelSchema,
    cadence: cadenceSchema,
    scheduleNote: z.string().trim().max(FAVORITE_ACTIVITY_NOTE_MAX).optional(),
    placeLabel: z.string().trim().max(FAVORITE_ACTIVITY_NOTE_MAX).optional(),
  })
  .strict();

export const replaceFavoriteActivitiesBodySchema = z
  .object({
    favoriteActivities: z.array(favoriteActivityItemSchema).max(FAVORITE_ACTIVITY_MAX_ITEMS),
  })
  .strict();

export type ReplaceFavoriteActivitiesInput = z.infer<typeof replaceFavoriteActivitiesBodySchema>;
export type FavoriteActivityItemInput = z.infer<typeof favoriteActivityItemSchema>;
