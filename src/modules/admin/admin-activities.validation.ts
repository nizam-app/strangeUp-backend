import { z } from "zod";
import { ADMIN_ACTIVITY_MONTH_RE } from "./admin-activities-presentation.js";

const locationFilter = z.string().trim().min(2).max(80).optional();

const monthFilter = z
  .string()
  .trim()
  .regex(ADMIN_ACTIVITY_MONTH_RE, "Month must be YYYY-MM")
  .optional();

export const adminActivitiesListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/, "Invalid cursor format")
      .optional(),
    q: z.string().trim().max(120).optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"]).optional(),
    mode: z.enum(["IN_PERSON", "VIRTUAL", "HYBRID"]).optional(),
    audience: z.enum(["PUBLIC", "FOLLOWERS_ONLY"]).optional(),
    category: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid category slug")
      .optional(),
    location: locationFilter,
    month: monthFilter,
    when: z.enum(["upcoming", "past", "active", "all"]).optional(),
  })
  .strict();

export const adminActivitiesExportQuerySchema = adminActivitiesListQuerySchema
  .omit({ limit: true, cursor: true })
  .strict();

export const adminActivitiesSummaryQuerySchema = z.object({}).strict();

export const adminActivitiesActivityIdParamsSchema = z
  .object({
    activityId: z.string().uuid(),
  })
  .strict();
