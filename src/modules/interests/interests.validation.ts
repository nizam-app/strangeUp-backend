import { z } from "zod";
import { INTEREST_MAX_SELECTION, INTEREST_SLUGS } from "./interest-catalog.js";

const interestSlugSchema = z.enum(INTEREST_SLUGS);

export const replaceInterestsBodySchema = z
  .object({
    interests: z
      .array(interestSlugSchema)
      .max(INTEREST_MAX_SELECTION)
      .refine((slugs) => new Set(slugs).size === slugs.length, {
        message: "Duplicate interest slugs are not allowed",
      }),
  })
  .strict();

export type ReplaceInterestsInput = z.infer<typeof replaceInterestsBodySchema>;
