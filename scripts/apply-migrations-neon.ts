/**
 * Forward-only prisma migrate deploy against isolated Neon catalogs.
 * Uses direct (non-pooler) connections. Never targets neondb or strangeup_dev for integration.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import {
  REQUIRED_DEVELOPMENT_DATABASE,
  REQUIRED_INTEGRATION_DATABASE,
  assertSafeMigrationCatalog,
  parseDatabaseTarget,
  redactDatabaseUrl,
  toNeonDirectConnectionString,
} from "../tests/setup/integration-database-guard.js";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required in .env`);
  }
  return value;
}

function migrate(label: string, url: string, expected: string): void {
  const target = parseDatabaseTarget(url);
  assertSafeMigrationCatalog(
    target.database,
    label === "development" ? "development" : "integration",
  );
  if (target.database !== expected) {
    throw new Error(`Refusing to migrate ${label} (${target.database})`);
  }

  const direct = toNeonDirectConnectionString(url);
  console.log(`Migrating ${label}: ${redactDatabaseUrl(direct)}`);

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
    throw new Error(`prisma migrate deploy failed for ${label}`);
  }
}

function main(): void {
  const devUrl = requireEnv("DATABASE_URL");
  const testUrl = requireEnv("INTEGRATION_DATABASE_URL");

  migrate("development", devUrl, REQUIRED_DEVELOPMENT_DATABASE);
  migrate("integration", testUrl, REQUIRED_INTEGRATION_DATABASE);
  console.log("Forward-only Neon migrations complete.");
}

try {
  main();
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
}
