import type { VerificationSessionStatus } from "../../../generated/prisma/client.js";

/** Veriff decision webhook `verification.status` values (documented). */
export const VERIFF_DECISION_STATUSES = [
  "approved",
  "declined",
  "resubmission_requested",
  "expired",
  "abandoned",
  "review",
] as const;

export type VeriffDecisionStatus = (typeof VERIFF_DECISION_STATUSES)[number];

export function mapVeriffDecisionToSessionStatus(
  status: VeriffDecisionStatus,
): VerificationSessionStatus {
  switch (status) {
    case "approved":
      return "APPROVED";
    case "declined":
      return "DECLINED";
    case "resubmission_requested":
      return "RESUBMISSION_REQUESTED";
    case "review":
      return "IN_REVIEW";
    case "expired":
      return "EXPIRED";
    case "abandoned":
      return "ABANDONED";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** Stable idempotency key for Veriff decision webhooks (retries reuse the same payload). */
export function buildVeriffProviderEventId(input: {
  providerSessionRef: string;
  decisionStatus: VeriffDecisionStatus;
  decisionTime?: string;
}): string {
  const timePart = input.decisionTime?.trim() || "none";
  return `veriff:${input.providerSessionRef}:${input.decisionStatus}:${timePart}`;
}

export type TrustedUserDecisionBlockReason =
  "identity_revoked" | "superseded_by_newer_session" | "bound_to_other_trusted_session";

/**
 * Blocks applying provider APPROVED to the user when the session is stale or identity was revoked.
 * Session row may still reflect provider outcome separately.
 */
export function trustedUserDecisionBlockedReason(input: {
  decisionStatus: VerificationSessionStatus;
  sessionId: string;
  sessionCreatedAt: Date;
  userIdentityRevokedAt: Date | null;
  userIdentityVerificationSessionId: string | null;
  hasNewerVerificationSession: boolean;
}): TrustedUserDecisionBlockReason | null {
  if (input.decisionStatus !== "APPROVED") {
    return null;
  }
  if (input.userIdentityRevokedAt) {
    return "identity_revoked";
  }
  if (input.hasNewerVerificationSession) {
    return "superseded_by_newer_session";
  }
  if (
    input.userIdentityVerificationSessionId &&
    input.userIdentityVerificationSessionId !== input.sessionId
  ) {
    return "bound_to_other_trusted_session";
  }
  return null;
}
