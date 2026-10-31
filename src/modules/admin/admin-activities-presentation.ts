import { AppError } from "../../common/errors/app-error.js";

export type AdminActivitySchedulePhase = "UPCOMING" | "IN_SESSION" | "ENDED";

export const ADMIN_ACTIVITY_MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
export const ADMIN_ACTIVITIES_UPCOMING_WINDOW_DAYS = 14;
export const ADMIN_ACTIVITY_ROSTER_LIMIT = 20;
export const ADMIN_ACTIVITIES_LOCATION_CATALOG_LIMIT = 100;

export function resolveActivitySchedulePhase(
  startsAt: Date,
  endsAt: Date,
  now: Date,
): AdminActivitySchedulePhase {
  if (now < startsAt) {
    return "UPCOMING";
  }
  if (now < endsAt) {
    return "IN_SESSION";
  }
  return "ENDED";
}

export function parseAdminActivityMonth(month: string): { gte: Date; lt: Date } {
  const match = ADMIN_ACTIVITY_MONTH_RE.exec(month.trim());
  if (!match) {
    throw new AppError("VALIDATION_ERROR", "Month must be YYYY-MM", 400);
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return {
    gte: new Date(Date.UTC(year, monthIndex, 1)),
    lt: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

export function upcomingWindowEnd(now: Date): Date {
  return new Date(now.getTime() + ADMIN_ACTIVITIES_UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export function formatLocationSummary(
  city: string | null | undefined,
  region: string | null | undefined,
): string | null {
  const parts = [city?.trim(), region?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}
