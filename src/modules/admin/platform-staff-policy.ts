import type { PlatformStaffRole, User } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";

export const IDENTITY_REVIEWER_ROLE: PlatformStaffRole = "IDENTITY_REVIEWER";
export const STORE_CATALOG_MANAGER_ROLE: PlatformStaffRole = "STORE_CATALOG_MANAGER";

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

export function assertNotSelfReview(reviewer: User, subjectUserId: string): void {
  if (reviewer.id === subjectUserId) {
    throw new Error("SELF_REVIEW_FORBIDDEN");
  }
}
