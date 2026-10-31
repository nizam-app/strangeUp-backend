/**
 * Task 035A — read-only dashboard sandbox check. No writes.
 */
import { loadManualKycTestProcessEnv } from "./manual-kyc-test-config.js";
import { createPrismaClient, disconnectPrisma } from "../src/infrastructure/database/prisma.js";
import { resolveManualKycTestDatabaseUrl } from "../tests/setup/integration-database-guard.js";

const BFF = "http://127.0.0.1:3011";
const ORIGIN = "http://localhost:5174";
const SYNTHETIC_PASSWORD = "ValidPass1";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "[redacted]";
  return `${local.slice(0, 3)}***@${domain}`;
}

async function main() {
  const env = loadManualKycTestProcessEnv();
  const url = resolveManualKycTestDatabaseUrl(env);
  const db = createPrismaClient(url);
  try {
    const identity = await db.$queryRaw<Array<{ database: string }>>`
      SELECT current_database() AS database
    `;
    const catalog = identity[0]?.database ?? "unknown";
    console.log(`catalog=${catalog}`);
    if (catalog !== "strangeup_test") {
      throw new Error(`Refusing to continue: expected strangeup_test, got ${catalog}`);
    }

    const [users, active, identityApproved, homeApproved, activities, published] =
      await Promise.all([
        db.user.count({ where: { deletedAt: null } }),
        db.user.count({ where: { deletedAt: null, accountStatus: "ACTIVE" } }),
        db.user.count({ where: { deletedAt: null, identityVerificationStatus: "APPROVED" } }),
        db.user.count({ where: { deletedAt: null, adminReviewStatus: "APPROVED" } }),
        db.activity.count(),
        db.activity.count({ where: { status: "PUBLISHED" } }),
      ]);
    console.log(
      `direct users=${users} activeAccounts=${active} identityApproved=${identityApproved} homeApproved=${homeApproved} activities=${activities} published=${published}`,
    );

    const grant = await db.platformStaffGrant.findFirst({
      where: { revokedAt: null, role: { in: ["IDENTITY_REVIEWER", "SUPER_ADMIN"] } },
      include: { user: { select: { email: true, deletedAt: true, accountStatus: true } } },
      orderBy: { grantedAt: "asc" },
    });
    if (!grant || grant.user.deletedAt) {
      throw new Error("No active staff grant found");
    }
    console.log(
      `staff=${maskEmail(grant.user.email)} status=${grant.user.accountStatus} role=${grant.role}`,
    );

    const login = await fetch(`${BFF}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({ email: grant.user.email, password: SYNTHETIC_PASSWORD }),
    });
    const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    console.log(`bffLogin=${login.status} cookie=${cookie ? "yes" : "no"}`);

    const overview = await fetch(`${BFF}/api/dashboard/overview?range=last_30_days`, {
      headers: { Cookie: cookie, Origin: ORIGIN },
    });
    const overviewJson = (await overview.json()) as {
      data?: {
        kpis: {
          totalUsers: { value: number };
          activeAccounts: { value: number; label: string };
          verified: { value: number; secondary: { value: number } };
          premium: { available: boolean };
          revenue: { available: boolean };
          activities: { value: number };
          pendingModeration: { value: number };
        };
        realtimePush: boolean;
      };
      error?: { code: string };
    };
    console.log(`overview=${overview.status}`);
    if (!overviewJson.data) {
      console.log(`overviewError=${overviewJson.error?.code ?? "none"}`);
      return;
    }
    const k = overviewJson.data.kpis;
    console.log(
      `api users=${k.totalUsers.value} active=${k.activeAccounts.value} verified=${k.verified.value} home=${k.verified.secondary.value} activities=${k.activities.value} pending=${k.pendingModeration.value} premium=${k.premium.available} revenue=${k.revenue.available} realtime=${overviewJson.data.realtimePush}`,
    );
    console.log(
      `reconcile users=${k.totalUsers.value === users} active=${k.activeAccounts.value === active} verified=${k.verified.value === identityApproved} home=${k.verified.secondary.value === homeApproved} activities=${k.activities.value === activities}`,
    );

    const forbidden = await fetch(`${BFF}/api/dashboard/overview`, {
      headers: { Origin: ORIGIN },
    });
    console.log(`unauthenticated=${forbidden.status}`);
  } finally {
    await disconnectPrisma();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
