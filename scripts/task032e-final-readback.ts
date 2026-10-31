/**
 * Task 032E — final grant/status read-back. Catalog names and IDs only.
 */
import { loadManualKycTestProcessEnv } from "./manual-kyc-test-config.js";
import {
  REQUIRED_INTEGRATION_DATABASE,
  resolveManualKycTestDatabaseUrl,
  verifyIntegrationDatabaseIdentity,
} from "../tests/setup/integration-database-guard.js";
import { createPrismaClient } from "../src/infrastructure/database/prisma.js";

const REVIEWER_ID = "2d2c65f8-a06f-4150-805e-dd97fdac9e55";
const REVIEWER_ONLY_ID = "b5edfa9c-cd29-4697-80c8-d1fde72740d8";
const TARGET_ID = "40232d92-ebb2-42f1-a7cc-f16ee24c5ea0";

async function main(): Promise<void> {
  const env = loadManualKycTestProcessEnv();
  const url = resolveManualKycTestDatabaseUrl(env);
  const identity = await verifyIntegrationDatabaseIdentity(url);
  if (identity.database !== REQUIRED_INTEGRATION_DATABASE) {
    throw new Error(`Refusing ${identity.database}`);
  }
  const db = createPrismaClient(url);
  try {
    const live = await db.$queryRaw<Array<{ d: string }>>`SELECT current_database() AS d`;
    console.log(`current_database=${live[0]?.d}`);
    await db.session.updateMany({
      where: { userId: { in: [REVIEWER_ID, REVIEWER_ONLY_ID] }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    for (const userId of [REVIEWER_ID, REVIEWER_ONLY_ID]) {
      const grants = await db.platformStaffGrant.findMany({ where: { userId } });
      const activeSessions = await db.session.count({ where: { userId, revokedAt: null } });
      console.log(
        `${userId} grants=${grants.map((g) => `${g.role}:${g.revokedAt ? "revoked" : "active"}`).join(",") || "none"} activeSessions=${activeSessions}`,
      );
    }
    const target = await db.user.findUnique({
      where: { id: TARGET_ID },
      select: {
        accountStatus: true,
        suspendedAt: true,
        identityVerificationStatus: true,
        adminReviewStatus: true,
      },
    });
    console.log(
      `target ${TARGET_ID} status=${target?.accountStatus} suspendedAt=${target?.suspendedAt?.toISOString() ?? "null"} identity=${target?.identityVerificationStatus} admin=${target?.adminReviewStatus}`,
    );
    const superAdmins = await db.platformStaffGrant.count({
      where: { role: "SUPER_ADMIN", revokedAt: null },
    });
    console.log(`active SUPER_ADMIN grants=${superAdmins}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
