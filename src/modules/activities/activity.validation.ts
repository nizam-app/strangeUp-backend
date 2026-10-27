import { z } from "zod";
import { LOCATION_CITY_MAX, LOCATION_REGION_MAX } from "../me/profile-location.js";
import { ACTIVITY_CATEGORY_SLUGS } from "./activity-catalog.js";
import {
  ACTIVITY_CAPACITY_MAX,
  ACTIVITY_CAPACITY_MIN,
  ACTIVITY_DESCRIPTION_MAX,
  ACTIVITY_GEAR_NOTES_MAX,
  ACTIVITY_LIST_MAX_LIMIT,
  ACTIVITY_MEETING_INSTRUCTIONS_MAX,
  ACTIVITY_SEARCH_Q_MAX,
  ACTIVITY_SKILL_NOTES_MAX,
  ACTIVITY_TITLE_MAX,
  ACTIVITY_VENUE_NAME_MAX,
  ACTIVITY_VIRTUAL_DETAILS_MAX,
} from "./activity.constants.js";

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

const optionalNullableText = (max: number) =>
  z.union([z.string().trim().min(1).max(max), z.null()]).optional();

export const activityModeSchema = z.enum(["IN_PERSON", "VIRTUAL", "HYBRID"]);
export const activityAudienceSchema = z.enum(["PUBLIC", "FOLLOWERS_ONLY"]);
export const activityStatusFilterSchema = z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"]);

export const activityIdParamSchema = z.object({
  activityId: z.string().uuid(),
});

export const activityListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(ACTIVITY_LIST_MAX_LIMIT).optional(),
    cursor: z.string().min(1).optional(),
    q: z.string().trim().min(1).max(ACTIVITY_SEARCH_Q_MAX).optional(),
    category: z.enum(ACTIVITY_CATEGORY_SLUGS).optional(),
    city: z.string().trim().min(1).max(LOCATION_CITY_MAX).optional(),
    region: z.string().trim().min(1).max(LOCATION_REGION_MAX).optional(),
    mode: activityModeSchema.optional(),
    startsAfter: z.iso.datetime().optional(),
    startsBefore: z.iso.datetime().optional(),
  })
  .strict();

export const hostActivityListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(ACTIVITY_LIST_MAX_LIMIT).optional(),
    cursor: z.string().min(1).optional(),
    status: activityStatusFilterSchema.optional(),
  })
  .strict();

export const myRsvpListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(ACTIVITY_LIST_MAX_LIMIT).optional(),
    cursor: z.string().min(1).optional(),
  })
  .strict();

const scheduleFields = {
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  timeZone: ianaTimeZoneSchema,
};

function assertEndAfterStart(startsAt: string, endsAt: string): boolean {
  return Date.parse(endsAt) > Date.parse(startsAt);
}

export const createActivityBodySchema = z
  .object({
    title: z.string().trim().min(1).max(ACTIVITY_TITLE_MAX),
    description: z.string().trim().max(ACTIVITY_DESCRIPTION_MAX).optional(),
    category: z.enum(ACTIVITY_CATEGORY_SLUGS),
    ...scheduleFields,
    mode: activityModeSchema,
    audience: activityAudienceSchema.optional(),
    venueName: z.string().trim().min(1).max(ACTIVITY_VENUE_NAME_MAX).optional(),
    locationCity: z.string().trim().min(1).max(LOCATION_CITY_MAX).optional(),
    locationRegion: z.string().trim().min(1).max(LOCATION_REGION_MAX).optional(),
    meetingInstructions: z.string().trim().min(1).max(ACTIVITY_MEETING_INSTRUCTIONS_MAX).optional(),
    virtualMeetingDetails: z.string().trim().min(1).max(ACTIVITY_VIRTUAL_DETAILS_MAX).optional(),
    skillNotes: z.string().trim().min(1).max(ACTIVITY_SKILL_NOTES_MAX).optional(),
    gearNotes: z.string().trim().min(1).max(ACTIVITY_GEAR_NOTES_MAX).optional(),
    capacity: z.number().int().min(ACTIVITY_CAPACITY_MIN).max(ACTIVITY_CAPACITY_MAX),
    waitlistEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((body) => assertEndAfterStart(body.startsAt, body.endsAt), {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });

export const patchActivityBodySchema = z
  .object({
    title: z.string().trim().min(1).max(ACTIVITY_TITLE_MAX).optional(),
    description: optionalNullableText(ACTIVITY_DESCRIPTION_MAX),
    category: z.enum(ACTIVITY_CATEGORY_SLUGS).optional(),
    startsAt: z.iso.datetime().optional(),
    endsAt: z.iso.datetime().optional(),
    timeZone: ianaTimeZoneSchema.optional(),
    mode: activityModeSchema.optional(),
    audience: activityAudienceSchema.optional(),
    venueName: optionalNullableText(ACTIVITY_VENUE_NAME_MAX),
    locationCity: optionalNullableText(LOCATION_CITY_MAX),
    locationRegion: optionalNullableText(LOCATION_REGION_MAX),
    meetingInstructions: optionalNullableText(ACTIVITY_MEETING_INSTRUCTIONS_MAX),
    virtualMeetingDetails: optionalNullableText(ACTIVITY_VIRTUAL_DETAILS_MAX),
    skillNotes: optionalNullableText(ACTIVITY_SKILL_NOTES_MAX),
    gearNotes: optionalNullableText(ACTIVITY_GEAR_NOTES_MAX),
    capacity: z.number().int().min(ACTIVITY_CAPACITY_MIN).max(ACTIVITY_CAPACITY_MAX).optional(),
    waitlistEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one activity field is required",
  })
  .refine(
    (body) => {
      if (body.startsAt && body.endsAt) {
        return assertEndAfterStart(body.startsAt, body.endsAt);
      }
      return true;
    },
    { message: "endsAt must be after startsAt", path: ["endsAt"] },
  );

export type CreateActivityInput = z.infer<typeof createActivityBodySchema>;
export type PatchActivityInput = z.infer<typeof patchActivityBodySchema>;
export type ActivityListQuery = z.infer<typeof activityListQuerySchema>;
export type HostActivityListQuery = z.infer<typeof hostActivityListQuerySchema>;
export type MyRsvpListQuery = z.infer<typeof myRsvpListQuerySchema>;
