import { z } from "zod";

const ianaTimeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Invalid IANA time zone");

export const profilePatchSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    displayName: z.string().trim().min(1).max(120).optional(),
    bio: z.string().trim().max(500).optional(),
    scheduleTimeZone: ianaTimeZoneSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one profile field is required",
  });

export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
