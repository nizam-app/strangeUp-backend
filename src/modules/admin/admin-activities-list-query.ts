import { createHash } from "node:crypto";
import type {
  ActivityAudience,
  ActivityMode,
  ActivityStatus,
  Prisma,
} from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { normalizeEmail } from "../auth/crypto.js";
import { decodeListCursor, encodeListCursor } from "./identity-admin-review-list-query.js";
import { parseAdminActivityMonth } from "./admin-activities-presentation.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AdminActivitiesWhenFilter = "upcoming" | "past" | "active" | "all";

export type AdminActivitiesListFilters = {
  q?: string;
  status?: ActivityStatus;
  mode?: ActivityMode;
  audience?: ActivityAudience;
  category?: string;
  location?: string;
  month?: string;
  when?: AdminActivitiesWhenFilter;
};

export { decodeListCursor, encodeListCursor };

export function buildActivitySearchWhere(qRaw?: string): Prisma.ActivityWhereInput | null {
  const q = qRaw?.trim();
  if (!q) {
    return null;
  }

  if (UUID_RE.test(q)) {
    const id = q.toLowerCase();
    return { OR: [{ id }, { hostId: id }] };
  }

  if (q.includes("@")) {
    const normalized = normalizeEmail(q);
    if (normalized.length < 3) {
      throw new AppError("VALIDATION_ERROR", "Email search query is too short", 400);
    }
    return { host: { is: { emailNormalized: { startsWith: normalized } } } };
  }

  if (q.length < 2) {
    throw new AppError("VALIDATION_ERROR", "Search query must be at least 2 characters", 400);
  }

  return {
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { category: { is: { label: { contains: q, mode: "insensitive" } } } },
      { category: { is: { slug: { contains: q, mode: "insensitive" } } } },
      {
        host: {
          is: {
            profile: {
              is: {
                OR: [
                  { displayName: { contains: q, mode: "insensitive" } },
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      },
    ],
  };
}

export function buildAdminActivitiesListWhere(
  filters: AdminActivitiesListFilters,
  now: Date,
): Prisma.ActivityWhereInput {
  const and: Prisma.ActivityWhereInput[] = [];

  if (filters.status) {
    and.push({ status: filters.status });
  }
  if (filters.mode) {
    and.push({ mode: filters.mode });
  }
  if (filters.audience) {
    and.push({ audience: filters.audience });
  }
  if (filters.category) {
    and.push({ category: { slug: filters.category } });
  }
  if (filters.location?.trim()) {
    const location = filters.location.trim();
    if (location.length < 2) {
      throw new AppError("VALIDATION_ERROR", "Location filter must be at least 2 characters", 400);
    }
    and.push({
      OR: [
        { locationCity: { contains: location, mode: "insensitive" } },
        { locationRegion: { contains: location, mode: "insensitive" } },
      ],
    });
  }
  if (filters.month) {
    const range = parseAdminActivityMonth(filters.month);
    and.push({ startsAt: { gte: range.gte, lt: range.lt } });
  }
  if (filters.when === "upcoming") {
    and.push({ startsAt: { gte: now } });
  }
  if (filters.when === "past") {
    and.push({ startsAt: { lt: now } });
  }
  if (filters.when === "active") {
    and.push({ startsAt: { lte: now }, endsAt: { gt: now } });
  }

  const search = buildActivitySearchWhere(filters.q);
  if (search) {
    and.push(search);
  }

  return and.length > 0 ? { AND: and } : {};
}

export function buildAdminActivitiesFilterFingerprint(filters: AdminActivitiesListFilters): string {
  const payload = JSON.stringify({
    q: filters.q?.trim() ?? "",
    status: filters.status ?? "",
    mode: filters.mode ?? "",
    audience: filters.audience ?? "",
    category: filters.category ?? "",
    location: filters.location?.trim() ?? "",
    month: filters.month ?? "",
    when: filters.when ?? "",
  });
  return createHash("sha256").update(payload, "utf8").digest("base64url").slice(0, 22);
}
