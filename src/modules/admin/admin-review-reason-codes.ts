/** Bounded admin rejection reason codes (safe for audit; not shown verbatim to applicants in Phase 022B). */
export const ADMIN_IDENTITY_REVIEW_REJECT_REASON_CODES = [
  "POLICY_INELIGIBLE",
  "IDENTITY_MISMATCH",
  "INSUFFICIENT_EVIDENCE",
  "FRAUD_SUSPECTED",
  "OTHER_ADMIN_DECISION",
] as const;

export type AdminIdentityReviewRejectReasonCode =
  (typeof ADMIN_IDENTITY_REVIEW_REJECT_REASON_CODES)[number];

export function isAdminIdentityReviewRejectReasonCode(
  value: string,
): value is AdminIdentityReviewRejectReasonCode {
  return (ADMIN_IDENTITY_REVIEW_REJECT_REASON_CODES as readonly string[]).includes(value);
}
