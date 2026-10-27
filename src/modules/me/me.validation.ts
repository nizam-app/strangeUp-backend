import { z } from "zod";
import { PROFILE_BIO_MAX_LENGTH } from "./profile-bio.js";
import { LOCATION_CITY_MAX, LOCATION_REGION_MAX } from "./profile-location.js";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from "./username.js";

const profileVisibilitySchema = z.enum(["EVERYONE", "VERIFIED_USERS_ONLY"]);

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

const usernameFieldSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN_LENGTH)
  .max(USERNAME_MAX_LENGTH)
  .refine((value) => USERNAME_PATTERN.test(value), {
    message: "Username must use lowercase letters, numbers, and underscores only",
  });

export const profilePatchSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    displayName: z.string().trim().min(1).max(120).optional(),
    username: z.union([usernameFieldSchema, z.null()]).optional(),
    bio: z.string().trim().max(PROFILE_BIO_MAX_LENGTH).optional(),
    scheduleTimeZone: ianaTimeZoneSchema.optional(),
    profileVisibility: profileVisibilitySchema.optional(),
    locationCity: z.union([z.string().trim().min(1).max(LOCATION_CITY_MAX), z.null()]).optional(),
    locationRegion: z
      .union([z.string().trim().min(1).max(LOCATION_REGION_MAX), z.null()])
      .optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one profile field is required",
  });

export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
