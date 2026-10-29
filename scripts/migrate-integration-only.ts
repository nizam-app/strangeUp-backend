/**
 * Forward-only prisma migrate deploy against INTEGRATION_DATABASE_URL (strangeup_test) only.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import {
  REQUIRED_INTEGRATION_DATABASE,
  assertSafeMigrationCatalog,
  parseDatabaseTarget,
  toNeonDirectConnectionString,
} from "../tests/setup/integration-database-guard.js";

function main(): void {
  const url = process.env.INTEGRATION_DATABASE_URL?.trim();
  if (!url) {
    throw new Error("INTEGRATION_DATABASE_URL is required");
  }
  const target = parseDatabaseTarget(url);
  assertSafeMigrationCatalog(target.database, "integration");
  if (target.database !== REQUIRED_INTEGRATION_DATABASE) {
    throw new Error(`Refusing to migrate non-integration catalog: ${target.database}`);
  }
  const direct = toNeonDirectConnectionString(url);
  console.log(`Migrating integration catalog: ${target.database}`);
  const result = spawnSync(
    "npx",
    ["prisma", "migrate", "deploy", "--config", "prisma7.config.ts"],
    {
      env: { ...process.env, DATABASE_URL: direct },
      stdio: "inherit",
      shell: true,
    },
  );
  if (result.status !== 0) {
    throw new Error("prisma migrate deploy failed for integration");
  }
}

main();
