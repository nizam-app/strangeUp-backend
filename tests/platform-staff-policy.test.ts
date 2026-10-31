import { describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "../src/infrastructure/database/prisma.js";
import {
  IDENTITY_REVIEWER_ROLE,
  STORE_CATALOG_MANAGER_ROLE,
  SUPER_ADMIN_ROLE,
  userHasActivePlatformStaffRoleOrSuperAdmin,
  userIsActiveSuperAdmin,
} from "../src/modules/admin/platform-staff-policy.js";

function mockDb(grants: Record<string, { revokedAt: Date | null } | null>): DatabaseClient {
  return {
    platformStaffGrant: {
      findUnique: vi.fn(
        ({ where }: { where: { userId_role: { userId: string; role: string } } }) => {
          const key = `${where.userId_role.userId}:${where.userId_role.role}`;
          const row = grants[key];
          if (row === null || row === undefined) {
            return Promise.resolve(null);
          }
          return Promise.resolve({ revokedAt: row.revokedAt });
        },
      ),
    },
  } as unknown as DatabaseClient;
}

describe("platform staff policy (SUPER_ADMIN)", () => {
  const userId = "11111111-1111-1111-1111-111111111111";

  it("super admin satisfies identity reviewer gate", async () => {
    const db = mockDb({
      [`${userId}:${SUPER_ADMIN_ROLE}`]: { revokedAt: null },
    });
    await expect(
      userHasActivePlatformStaffRoleOrSuperAdmin(db, userId, IDENTITY_REVIEWER_ROLE),
    ).resolves.toBe(true);
  });

  it("super admin satisfies store catalog manager gate", async () => {
    const db = mockDb({
      [`${userId}:${SUPER_ADMIN_ROLE}`]: { revokedAt: null },
    });
    await expect(
      userHasActivePlatformStaffRoleOrSuperAdmin(db, userId, STORE_CATALOG_MANAGER_ROLE),
    ).resolves.toBe(true);
  });

  it("revoked super admin does not satisfy gates", async () => {
    const db = mockDb({
      [`${userId}:${SUPER_ADMIN_ROLE}`]: { revokedAt: new Date() },
    });
    await expect(userIsActiveSuperAdmin(db, userId)).resolves.toBe(false);
    await expect(
      userHasActivePlatformStaffRoleOrSuperAdmin(db, userId, IDENTITY_REVIEWER_ROLE),
    ).resolves.toBe(false);
  });

  it("scoped reviewer without super admin still works", async () => {
    const db = mockDb({
      [`${userId}:${IDENTITY_REVIEWER_ROLE}`]: { revokedAt: null },
    });
    await expect(
      userHasActivePlatformStaffRoleOrSuperAdmin(db, userId, IDENTITY_REVIEWER_ROLE),
    ).resolves.toBe(true);
    await expect(
      userHasActivePlatformStaffRoleOrSuperAdmin(db, userId, STORE_CATALOG_MANAGER_ROLE),
    ).resolves.toBe(false);
  });
});
