import type { PlatformStaffRole } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { IDENTITY_REVIEWER_ROLE } from "./platform-staff-policy.js";

/**
 * Non-production optional bootstrap: grants IDENTITY_REVIEWER to configured user IDs.
 * No HTTP endpoint — set PLATFORM_IDENTITY_REVIEWER_USER_IDS in deployment/test env only.
 */
export async function syncPlatformStaffBootstrapGrants(
  db: DatabaseClient,
  env: AppEnv,
): Promise<void> {
  if (env.isProduction) {
    return;
  }
  const raw = env.PLATFORM_IDENTITY_REVIEWER_USER_IDS?.trim();
  if (!raw) {
    return;
  }
  const userIds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const userId of userIds) {
    await upsertStaffGrant(db, userId, IDENTITY_REVIEWER_ROLE, null);
  }
}

export async function upsertStaffGrant(
  db: DatabaseClient,
  userId: string,
  role: PlatformStaffRole,
  grantedByUserId: string | null,
): Promise<void> {
  await db.platformStaffGrant.upsert({
    where: { userId_role: { userId, role } },
    create: { userId, role, grantedByUserId },
    update: { revokedAt: null, grantedAt: new Date(), grantedByUserId },
  });
}
