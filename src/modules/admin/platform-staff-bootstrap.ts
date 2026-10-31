import type { PlatformStaffRole } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import {
  IDENTITY_REVIEWER_ROLE,
  STORE_CATALOG_MANAGER_ROLE,
  SUPER_ADMIN_ROLE,
} from "./platform-staff-policy.js";

function parseUserIdList(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Non-production optional bootstrap for PlatformStaffGrant rows.
 * No HTTP endpoint — env-driven local/test tooling only.
 */
export async function syncPlatformStaffBootstrapGrants(
  db: DatabaseClient,
  env: AppEnv,
): Promise<void> {
  if (env.isProduction) {
    return;
  }

  for (const userId of parseUserIdList(env.PLATFORM_SUPER_ADMIN_USER_IDS)) {
    await upsertStaffGrant(db, userId, SUPER_ADMIN_ROLE, null);
  }

  for (const userId of parseUserIdList(env.PLATFORM_IDENTITY_REVIEWER_USER_IDS)) {
    await upsertStaffGrant(db, userId, IDENTITY_REVIEWER_ROLE, null);
  }

  for (const userId of parseUserIdList(env.PLATFORM_STORE_CATALOG_MANAGER_USER_IDS)) {
    await upsertStaffGrant(db, userId, STORE_CATALOG_MANAGER_ROLE, null);
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

export async function revokeStaffGrant(
  db: DatabaseClient,
  userId: string,
  role: PlatformStaffRole,
): Promise<void> {
  await db.platformStaffGrant.updateMany({
    where: { userId, role, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
