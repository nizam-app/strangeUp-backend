import { z } from "zod";
import { DASHBOARD_EVENT_CATEGORIES } from "./admin-dashboard-events.js";
import { DASHBOARD_RANGE_IDS } from "./admin-dashboard-range.js";

export const adminDashboardRangeQuerySchema = z
  .object({
    range: z.enum(DASHBOARD_RANGE_IDS).default("last_30_days"),
  })
  .strict();

export const adminDashboardCategoriesQuerySchema = z
  .object({
    range: z.enum(DASHBOARD_RANGE_IDS).default("last_30_days"),
    limit: z.coerce.number().int().min(1).max(12).default(4),
  })
  .strict();

export const adminDashboardQueueQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(10).default(5),
  })
  .strict();

export const adminDashboardEventsQuerySchema = z
  .object({
    category: z.enum(DASHBOARD_EVENT_CATEGORIES).default("all"),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/, "Invalid cursor format")
      .optional(),
  })
  .strict();

export const adminDashboardExportQuerySchema = adminDashboardRangeQuerySchema;
