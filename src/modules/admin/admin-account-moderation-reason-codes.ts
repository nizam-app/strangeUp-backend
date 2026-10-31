/** Documented account-moderation reason codes (Task 032C). Distinct from identity reject codes. */
export const ADMIN_ACCOUNT_SUSPEND_REASON_CODES = [
  "POLICY_VIOLATION",
  "ABUSE",
  "FRAUD",
  "SAFETY",
  "LEGAL_REQUEST",
  "OTHER",
] as const;

export type AdminAccountSuspendReasonCode = (typeof ADMIN_ACCOUNT_SUSPEND_REASON_CODES)[number];

export const ADMIN_ACCOUNT_RESTORE_REASON_CODE = "ACCOUNT_RESTORED" as const;

export function isAdminAccountSuspendReasonCode(
  value: string,
): value is AdminAccountSuspendReasonCode {
  return (ADMIN_ACCOUNT_SUSPEND_REASON_CODES as readonly string[]).includes(value);
}
