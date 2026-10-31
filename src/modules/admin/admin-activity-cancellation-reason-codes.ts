/** Documented admin activity-cancel reason codes (Task 033D). */
export const ADMIN_ACTIVITY_CANCEL_REASON_CODES = [
  "POLICY_VIOLATION",
  "SAFETY",
  "ABUSE",
  "FRAUD",
  "LEGAL_REQUEST",
  "OTHER",
] as const;

export type AdminActivityCancelReasonCode = (typeof ADMIN_ACTIVITY_CANCEL_REASON_CODES)[number];

export function isAdminActivityCancelReasonCode(
  value: string,
): value is AdminActivityCancelReasonCode {
  return (ADMIN_ACTIVITY_CANCEL_REASON_CODES as readonly string[]).includes(value);
}
