/**
 * Live identity + Prisma migration table checks for the two Neon catalogs.
 * Prints catalog names only — never connection strings or secrets.
 */
import "dotenv/config";
import pg from "pg";
import {
  REQUIRED_DEVELOPMENT_DATABASE,
  REQUIRED_INTEGRATION_DATABASE,
  parseDatabaseTarget,
  redactDatabaseUrl,
  toNeonDirectConnectionString,
} from "../tests/setup/integration-database-guard.js";

type IdentityRow = { database: string; user: string; version: string };

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required in .env`);
  }
  return value;
}

async function inspect(label: string, url: string, expected: string): Promise<void> {
  const target = parseDatabaseTarget(url);
  if (target.database !== expected) {
    throw new Error(`${label} URL catalog is "${target.database}" but expected "${expected}"`);
  }

  const client = new pg.Client({
    connectionString: toNeonDirectConnectionString(url),
    connectionTimeoutMillis: 20_000,
  });
  await client.connect();
  try {
    const identity = await client.query<IdentityRow>(
      "SELECT current_database() AS database, current_user AS user, version() AS version",
    );
    const row = identity.rows[0];
    if (!row || row.database !== expected) {
      throw new Error(`${label} identity mismatch (expected ${expected})`);
    }

    const migrations = await client.query<{ migration_name: string; finished_at: Date | null }>(
      `SELECT migration_name, finished_at
       FROM "_prisma_migrations"
       ORDER BY finished_at ASC NULLS LAST, migration_name ASC`,
    );

    const finished = migrations.rows.filter((m) => m.finished_at).map((m) => m.migration_name);
    console.log(`${label}: ${redactDatabaseUrl(url)}`);
    console.log(`  current_database=${row.database} user=${row.user}`);
    console.log(`  engine=${row.version.split(",")[0] ?? "unknown"}`);
    console.log(`  applied_migrations=${finished.length}`);
    for (const name of finished) {
      console.log(`  - ${name}`);
    }
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const devUrl = requireEnv("DATABASE_URL");
  const testUrl = requireEnv("INTEGRATION_DATABASE_URL");

  const dev = parseDatabaseTarget(devUrl);
  const test = parseDatabaseTarget(testUrl);
  if (dev.hostname === test.hostname && dev.port === test.port && dev.database === test.database) {
    throw new Error("Development and integration URLs are not isolated");
  }

  await inspect("development", devUrl, REQUIRED_DEVELOPMENT_DATABASE);
  await inspect("integration", testUrl, REQUIRED_INTEGRATION_DATABASE);
  console.log("Neon health/identity checks passed.");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
