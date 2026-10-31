import { createHash } from "node:crypto";
import type { IdentityVerificationStatus, Prisma } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { normalizeEmail } from "../auth/crypto.js";
import type { IdentityReviewListStatus } from "./identity-admin-review.service.js";
import type { PendingQueuePosture } from "./identity-admin-review-queue-policy.js";
import {
  buildPendingSubmittedAtWhere,
  buildPendingTabEligibleWhere,
  pendingAdminQueueCriteria,
  platformPendingAdminQueueCriteria,
} from "./identity-admin-review-pending-eligibility.js";

export { pendingAdminQueueCriteria, platformPendingAdminQueueCriteria };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_DATE_RANGE_DAYS = 366;

export type IdentityReviewListFilters = {
  status: IdentityReviewListStatus;
  posture?: PendingQueuePosture;
  q?: string;
  submittedFrom?: string;
  submittedTo?: string;
  identityVerificationStatus?: IdentityVerificationStatus;
};

export type ParsedDateRange = {
  from: Date | null;
  to: Date | null;
};

export function parseSubmittedDateRange(
  submittedFrom?: string,
  submittedTo?: string,
): ParsedDateRange {
  if (!submittedFrom && !submittedTo) {
    return { from: null, to: null };
  }

  const from = submittedFrom ? startOfUtcDay(submittedFrom) : null;
  const to = submittedTo ? endOfUtcDay(submittedTo) : null;

  if (from && to && from.getTime() > to.getTime()) {
    throw new AppError("VALIDATION_ERROR", "submittedFrom must not be after submittedTo", 400);
  }

  if (from && to) {
    const days = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (days > MAX_DATE_RANGE_DAYS) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Date range must not exceed ${MAX_DATE_RANGE_DAYS} days`,
        400,
      );
    }
  }

  return { from, to };
}

function startOfUtcDay(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function endOfUtcDay(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

export function buildSearchWhere(qRaw?: string): Prisma.UserWhereInput | null {
  const q = qRaw?.trim();
  if (!q) {
    return null;
  }

  if (UUID_RE.test(q)) {
    return { id: q.toLowerCase() };
  }

  if (q.includes("@")) {
    const normalized = normalizeEmail(q);
    if (normalized.length < 3) {
      throw new AppError("VALIDATION_ERROR", "Email search query is too short", 400);
    }
    return { emailNormalized: { startsWith: normalized } };
  }

  if (q.length < 2) {
    throw new AppError("VALIDATION_ERROR", "Search query must be at least 2 characters", 400);
  }

  return {
    OR: [
      { profile: { is: { displayName: { contains: q, mode: "insensitive" } } } },
      { profile: { is: { firstName: { contains: q, mode: "insensitive" } } } },
      { profile: { is: { lastName: { contains: q, mode: "insensitive" } } } },
    ],
  };
}

export function buildProviderCompletedAtWhere(
  range: ParsedDateRange,
): Prisma.UserWhereInput | null {
  if (!range.from && !range.to) {
    return null;
  }
  return {
    identityVerificationSession: {
      is: {
        completedAt: {
          ...(range.from ? { gte: range.from } : {}),
          ...(range.to ? { lte: range.to } : {}),
        },
      },
    },
  };
}

export function buildIdentityReviewListWhere(
  filters: IdentityReviewListFilters,
  range: ParsedDateRange,
): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];

  if (filters.status === "PENDING") {
    and.push(buildPendingTabEligibleWhere(filters.posture ?? "all"));
  } else {
    and.push({ adminReviewStatus: filters.status });
  }

  const search = buildSearchWhere(filters.q);
  if (search) {
    and.push(search);
  }

  const submittedAt =
    filters.status === "PENDING"
      ? buildPendingSubmittedAtWhere(range)
      : buildProviderCompletedAtWhere(range);
  if (submittedAt) {
    and.push(submittedAt);
  }

  if (filters.identityVerificationStatus) {
    and.push({ identityVerificationStatus: filters.identityVerificationStatus });
  }

  return { AND: and };
}

export function buildFilterFingerprint(
  filters: IdentityReviewListFilters,
  range: ParsedDateRange,
): string {
  const payload = JSON.stringify({
    status: filters.status,
    posture: filters.status === "PENDING" ? (filters.posture ?? "all") : "",
    q: filters.q?.trim() ?? "",
    from: range.from?.toISOString() ?? "",
    to: range.to?.toISOString() ?? "",
    kyc: filters.identityVerificationStatus ?? "",
  });
  return createHash("sha256").update(payload, "utf8").digest("base64url").slice(0, 22);
}

export function encodeListCursor(value: {
  updatedAt: Date;
  userId: string;
  filterFingerprint: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      u: value.updatedAt.toISOString(),
      i: value.userId,
      f: value.filterFingerprint,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeListCursor(
  raw: string | undefined,
  expectedFingerprint: string,
): { updatedAt: Date; userId: string } | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      u?: string;
      i?: string;
      f?: string;
    };
    if (!parsed.u || !parsed.i) {
      throw new AppError("VALIDATION_ERROR", "Invalid pagination cursor", 400);
    }
    if (parsed.f !== expectedFingerprint) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Pagination cursor does not match current filters",
        400,
      );
    }
    return { updatedAt: new Date(parsed.u), userId: parsed.i };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError("VALIDATION_ERROR", "Invalid pagination cursor", 400);
  }
}
