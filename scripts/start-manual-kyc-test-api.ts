/**
 * Isolated Manual KYC test API — Neon strangeup_test only (Task 031J-1).
 * Does not migrate databases or call Cloudinary.
 */
import { spawn } from "node:child_process";
import {
  assertManualKycTestRuntimeReady,
  loadManualKycTestProcessEnv,
  MANUAL_KYC_TEST_DEFAULT_PORT,
} from "./manual-kyc-test-config.js";
import {
  redactDatabaseUrl,
  resolveManualKycTestDatabaseUrl,
} from "../tests/setup/integration-database-guard.js";

async function main(): Promise<void> {
  const env = loadManualKycTestProcessEnv();
  await assertManualKycTestRuntimeReady(env);

  const databaseUrl = resolveManualKycTestDatabaseUrl(env);
  const port = env.PORT ?? String(MANUAL_KYC_TEST_DEFAULT_PORT);

  console.log("Manual KYC test API — database guard OK");
  console.log(`  catalog: strangeup_test`);
  console.log(`  connection: ${redactDatabaseUrl(databaseUrl)}`);
  console.log(`  listen: http://127.0.0.1:${port}`);
  console.log(`  KYC_IDENTITY_AUTHORITY=${env.KYC_IDENTITY_AUTHORITY ?? "none"}`);
  console.log(`  KYC_MANUAL_REVIEW_ENABLED=${env.KYC_MANUAL_REVIEW_ENABLED ?? "false"}`);

  const child = spawn("npx", ["tsx", "watch", "src/server.ts"], {
    env: { ...process.env, ...env, DATABASE_URL: databaseUrl, PORT: port },
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
