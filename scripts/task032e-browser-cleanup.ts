/**
 * Task 032E — revoke temporary SUPER_ADMIN after Admin UI validation.
 */
import { loadManualKycTestProcessEnv } from "./manual-kyc-test-config.js";
import {
  REQUIRED_INTEGRATION_DATABASE,
  resolveManualKycTestDatabaseUrl,
  verifyIntegrationDatabaseIdentity,
} from "../tests/setup/integration-database-guard.js";
import { createPrismaClient } from "../src/infrastructure/database/prisma.js";
import { revokeStaffGrant } from "../src/modules/admin/platform-staff-bootstrap.js";
import { SUPER_ADMIN_ROLE } from "../src/modules/admin/platform-staff-policy.js";

const REVIEWER_ID = "2d2c65f8-a06f-4150-805e-dd97fdac9e55";
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
    await revokeStaffGrant(db, REVIEWER_ID, SUPER_ADMIN_ROLE);
    const target = await db.user.findUnique({
      where: { id: TARGET_ID },
      select: { accountStatus: true, suspendedAt: true },
    });
    if (target?.accountStatus === "SUSPENDED") {
      await db.user.update({
        where: { id: TARGET_ID },
        data: { accountStatus: "ACTIVE", suspendedAt: null },
      });
      console.log("Target was still SUSPENDED; restored to ACTIVE");
    }
    await db.session.updateMany({
      where: { userId: REVIEWER_ID, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const grants = await db.platformStaffGrant.findMany({ where: { userId: REVIEWER_ID } });
    const finalTarget = await db.user.findUnique({
      where: { id: TARGET_ID },
      select: { accountStatus: true, suspendedAt: true },
    });
    console.log(
      `Reviewer grants: ${grants.map((g) => `${g.role}:${g.revokedAt ? "revoked" : "active"}`).join(", ")}`,
    );
    console.log(
      `Target status: ${finalTarget?.accountStatus ?? "missing"} suspendedAt=${finalTarget?.suspendedAt?.toISOString() ?? "null"}`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
