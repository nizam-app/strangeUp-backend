/** Owner-approved username rules (Task 006). Stored canonical form is lowercase. */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export const USERNAME_PATTERN = /^[a-z0-9_]+$/;

export function isValidUsername(value: string): boolean {
  return (
    value.length >= USERNAME_MIN_LENGTH &&
    value.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(value)
  );
}

/** Normalize for persistence and uniqueness checks (defense in depth; API rejects non-lowercase). */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}
