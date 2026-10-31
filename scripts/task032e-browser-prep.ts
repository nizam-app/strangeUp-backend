/**
 * Task 032E — re-grant temporary SUPER_ADMIN for Admin UI validation.
 * Prints synthetic @example.com emails only. Refuses other catalogs.
 */
import { loadManualKycTestProcessEnv } from "./manual-kyc-test-config.js";
import {
  REQUIRED_INTEGRATION_DATABASE,
  resolveManualKycTestDatabaseUrl,
  verifyIntegrationDatabaseIdentity,
} from "../tests/setup/integration-database-guard.js";
import { createPrismaClient } from "../src/infrastructure/database/prisma.js";
import { upsertStaffGrant } from "../src/modules/admin/platform-staff-bootstrap.js";
import { SUPER_ADMIN_ROLE } from "../src/modules/admin/platform-staff-policy.js";

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
    if (live[0]?.d !== REQUIRED_INTEGRATION_DATABASE) {
      throw new Error(`Prisma identity ${live[0]?.d}`);
    }
    await upsertStaffGrant(db, REVIEWER_ID, SUPER_ADMIN_ROLE, null);
    const users = await db.user.findMany({
      where: { id: { in: [REVIEWER_ID, REVIEWER_ONLY_ID, TARGET_ID] } },
      select: { id: true, email: true, accountStatus: true },
    });
    for (const user of users) {
      if (!user.email.toLowerCase().endsWith("@example.com")) {
        throw new Error("Refusing non-synthetic email");
      }
      const label =
        user.id === REVIEWER_ID
          ? "REVIEWER"
          : user.id === REVIEWER_ONLY_ID
            ? "REVIEWER_ONLY"
            : "TARGET";
      console.log(`${label} ${user.id} ${user.email} ${user.accountStatus}`);
    }
    const grant = await db.platformStaffGrant.findUnique({
      where: { userId_role: { userId: REVIEWER_ID, role: "SUPER_ADMIN" } },
    });
    console.log(`SUPER_ADMIN_ACTIVE ${Boolean(grant && grant.revokedAt === null)}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
