/** Read-only: latest synthetic manual IN_REVIEW applicant on strangeup_test (no secrets logged). */
import { loadManualKycTestProcessEnv } from "./manual-kyc-test-config.js";
import { resolveManualKycTestDatabaseUrl } from "../tests/setup/integration-database-guard.js";
import { createPrismaClient, disconnectPrisma } from "../src/infrastructure/database/prisma.js";

async function main(): Promise<void> {
  loadManualKycTestProcessEnv();
  const db = createPrismaClient(resolveManualKycTestDatabaseUrl(process.env));
  const row = await db.verificationSession.findFirst({
    where: { provider: "MANUAL", status: "IN_REVIEW" },
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true, manualIdDocumentType: true },
  });
  if (!row) {
    console.log(JSON.stringify({ found: false }));
    return;
  }
  const evidenceCount = await db.manualVerificationEvidence.count({
    where: { verificationSessionId: row.id, deletedAt: null },
  });
  console.log(
    JSON.stringify({
      found: true,
      reviewUserId: row.userId,
      sessionId: row.id,
      documentType: row.manualIdDocumentType,
      activeEvidenceCount: evidenceCount,
    }),
  );
  await disconnectPrisma();
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
