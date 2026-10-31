import type { PlatformStaffRole, User } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";

export const IDENTITY_REVIEWER_ROLE: PlatformStaffRole = "IDENTITY_REVIEWER";
export const STORE_CATALOG_MANAGER_ROLE: PlatformStaffRole = "STORE_CATALOG_MANAGER";
export const SUPER_ADMIN_ROLE: PlatformStaffRole = "SUPER_ADMIN";

export async function userHasActivePlatformStaffRole(
  db: DatabaseClient,
  userId: string,
  role: PlatformStaffRole,
): Promise<boolean> {
  const grant = await db.platformStaffGrant.findUnique({
    where: { userId_role: { userId, role } },
  });
  return grant !== null && grant.revokedAt === null;
}

/** Active SUPER_ADMIN grant — owner-facing role that satisfies all staff-gated admin routes. */
export async function userIsActiveSuperAdmin(db: DatabaseClient, userId: string): Promise<boolean> {
  return userHasActivePlatformStaffRole(db, userId, SUPER_ADMIN_ROLE);
}

/**
 * Route-specific staff role, or SUPER_ADMIN (full access to implemented admin capabilities).
 * Does not bypass feature flags or authentication.
 */
export async function userHasActivePlatformStaffRoleOrSuperAdmin(
  db: DatabaseClient,
  userId: string,
  role: PlatformStaffRole,
): Promise<boolean> {
  if (role === SUPER_ADMIN_ROLE) {
    return userIsActiveSuperAdmin(db, userId);
  }
  if (await userIsActiveSuperAdmin(db, userId)) {
    return true;
  }
  return userHasActivePlatformStaffRole(db, userId, role);
}

export function assertNotSelfReview(reviewer: User, subjectUserId: string): void {
  if (reviewer.id === subjectUserId) {
    throw new Error("SELF_REVIEW_FORBIDDEN");
  }
}
