import type { Prisma, StrangeUpAdminReviewStatus } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";

export type PendingQueuePosture = "all" | "actionable" | "on_hold";

export const TERMINAL_ADMIN_REVIEW_STATUSES: StrangeUpAdminReviewStatus[] = [
  "APPROVED",
  "REJECTED",
];

export const OPEN_ADMIN_REVIEW_NOTE_STATUSES: StrangeUpAdminReviewStatus[] = [
  "PENDING",
  "NEEDS_FURTHER_REVIEW",
];

/** Pending tab rows: actionable PENDING and internal hold NEEDS_FURTHER_REVIEW. */
export function pendingTabAdminReviewStatuses(
  posture: PendingQueuePosture,
): StrangeUpAdminReviewStatus[] {
  if (posture === "actionable") {
    return ["PENDING"];
  }
  if (posture === "on_hold") {
    return ["NEEDS_FURTHER_REVIEW"];
  }
  return ["PENDING", "NEEDS_FURTHER_REVIEW"];
}

export function buildPendingTabStatusWhere(posture: PendingQueuePosture): Prisma.UserWhereInput {
  const statuses = pendingTabAdminReviewStatuses(posture);
  if (statuses.length === 1) {
    return { adminReviewStatus: statuses[0] };
  }
  return { adminReviewStatus: { in: statuses } };
}

export function assertNotSelfReview(reviewerId: string, subjectId: string): void {
  if (reviewerId === subjectId) {
    throw new AppError("AUTH_FORBIDDEN", "Administrators cannot review their own identity", 403);
  }
}

export function assertNotesAllowedForStatus(adminReviewStatus: StrangeUpAdminReviewStatus): void {
  if (TERMINAL_ADMIN_REVIEW_STATUSES.includes(adminReviewStatus)) {
    throw new AppError(
      "CONFLICT",
      "Internal notes cannot be added after the review is finalized",
      409,
    );
  }
  if (!OPEN_ADMIN_REVIEW_NOTE_STATUSES.includes(adminReviewStatus)) {
    throw new AppError("CONFLICT", "Internal notes are not available for this review state", 409);
  }
}

export function assertQueueSessionBinding(user: {
  identityVerificationSessionId: string | null;
  adminReviewVerificationSessionId: string | null;
}): void {
  if (
    !user.identityVerificationSessionId ||
    !user.adminReviewVerificationSessionId ||
    user.identityVerificationSessionId !== user.adminReviewVerificationSessionId
  ) {
    throw new AppError(
      "CONFLICT",
      "Admin review session does not match current provider verification session",
      409,
    );
  }
}
