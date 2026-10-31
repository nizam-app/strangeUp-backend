import type { Prisma } from "../../../generated/prisma/client.js";
import {
  buildPendingTabStatusWhere,
  type PendingQueuePosture,
} from "./identity-admin-review-queue-policy.js";
type SubmittedDateRange = {
  from: Date | null;
  to: Date | null;
};

/** Users awaiting Step B platform / Home access after provider or manual identity approval. */
export function platformPendingAdminQueueCriteria(): Prisma.UserWhereInput {
  return {
    identityVerificationStatus: "APPROVED",
    identityVerificationSessionId: { not: null },
    adminReviewVerificationSessionId: { not: null },
  };
}

/** @deprecated Prefer `platformPendingAdminQueueCriteria` — kept for existing imports/tests. */
export const pendingAdminQueueCriteria = platformPendingAdminQueueCriteria;

/**
 * Step A — manual identity submissions ready for staff (session IN_REVIEW, not expired/superseded).
 */
export function manualIdentityReviewPendingCriteria(): Prisma.UserWhereInput {
  return {
    deletedAt: null,
    identityVerificationRevokedAt: null,
    adminReviewStatus: "NOT_READY",
    identityVerificationSessionId: { not: null },
    identityVerificationSession: {
      is: {
        provider: "MANUAL",
        status: "IN_REVIEW",
        sessionExpiresAt: { gt: new Date() },
      },
    },
  };
}

export function buildPlatformPendingBranch(posture: PendingQueuePosture): Prisma.UserWhereInput {
  return {
    AND: [buildPendingTabStatusWhere(posture), platformPendingAdminQueueCriteria()],
  };
}

/** Pending tab eligibility: platform queue and/or manual identity review (Step A). */
export function buildPendingTabEligibleWhere(posture: PendingQueuePosture): Prisma.UserWhereInput {
  if (posture === "on_hold") {
    return buildPlatformPendingBranch("on_hold");
  }
  const platformPosture: PendingQueuePosture = posture === "actionable" ? "actionable" : "all";
  return {
    OR: [buildPlatformPendingBranch(platformPosture), manualIdentityReviewPendingCriteria()],
  };
}

export function buildPendingSubmittedAtWhere(
  range: SubmittedDateRange,
): Prisma.UserWhereInput | null {
  if (!range.from && !range.to) {
    return null;
  }
  const bounds = {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to } : {}),
  };
  return {
    OR: [
      {
        identityVerificationSession: {
          is: {
            completedAt: bounds,
          },
        },
      },
      {
        identityVerificationSession: {
          is: {
            provider: "MANUAL",
            status: "IN_REVIEW",
            updatedAt: bounds,
          },
        },
      },
    ],
  };
}
