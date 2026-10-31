/** Minimal profile fields for admin identity review DTOs (no DOB / full email). */
export type IdentityReviewProfileRow = {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarStorageKey: string | null;
  locationCity?: string | null;
  locationRegion?: string | null;
} | null;

export function resolveIdentityReviewDisplayName(profile: IdentityReviewProfileRow): string | null {
  if (!profile) {
    return null;
  }
  const trimmedDisplay = profile.displayName?.trim();
  if (trimmedDisplay) {
    return trimmedDisplay;
  }
  const parts = [profile.firstName, profile.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" ") : null;
}

export function profileHasAvatar(profile: IdentityReviewProfileRow): boolean {
  return Boolean(profile?.avatarStorageKey);
}

/** Staff-facing author label for internal notes (no email). */
export function resolveStaffAuthorDisplayLabel(
  profile: IdentityReviewProfileRow,
  authorUserId: string,
): string {
  const name = resolveIdentityReviewDisplayName(profile);
  if (name) {
    return name;
  }
  return `Staff ${authorUserId.slice(0, 8)}`;
}
