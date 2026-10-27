/**
 * Ensures isolated Neon catalogs strangeup_dev and strangeup_test exist.
 * Connects via the current .env bootstrap URLs (typically default neondb) using
 * direct (non-pooler) hosts. Never TRUNCATEs, drops, or migrates neondb.
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import {
  REQUIRED_DEVELOPMENT_DATABASE,
  REQUIRED_INTEGRATION_DATABASE,
  parseDatabaseTarget,
  redactDatabaseUrl,
  toNeonDirectConnectionString,
  withDatabaseName,
} from "../tests/setup/integration-database-guard.js";

type Identity = { database: string; user: string };

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required in .env`);
  }
  return value;
}

function toDirectWithoutChannelBinding(url: string): string {
  const parsed = new URL(toNeonDirectConnectionString(url));
  parsed.searchParams.delete("channel_binding");
  return parsed.toString();
}

async function withClient<T>(url: string, fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const candidates = [toNeonDirectConnectionString(url), toDirectWithoutChannelBinding(url)];
  let lastError: unknown;
  for (const candidate of candidates) {
    const client = new pg.Client({ connectionString: candidate, connectionTimeoutMillis: 20_000 });
    try {
      await client.connect();
      try {
        return await fn(client);
      } finally {
        await client.end();
      }
    } catch (err) {
      lastError = err;
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Could not connect (${redactDatabaseUrl(url)}): ${message}`);
}

async function ensureNamedDatabase(
  bootstrapUrl: string,
  desiredName: string,
): Promise<{
  created: boolean;
  identity: Identity;
}> {
  const bootstrap = parseDatabaseTarget(bootstrapUrl);
  if (!bootstrap.hostname.endsWith(".neon.tech")) {
    throw new Error(`Expected a Neon hostname (got ${bootstrap.hostname})`);
  }

  const created = await withClient(bootstrapUrl, async (admin) => {
    const existing = await admin.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname = $1",
      [desiredName],
    );
    if ((existing.rowCount ?? 0) > 0) {
      return false;
    }
    await admin.query(`CREATE DATABASE ${desiredName}`);
    return true;
  });

  const targetUrl = withDatabaseName(bootstrapUrl, desiredName);
  const identity = await withClient(targetUrl, async (client) => {
    const result = await client.query<Identity>(
      "SELECT current_database() AS database, current_user AS user",
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(`No identity row from ${desiredName}`);
    }
    if (row.database !== desiredName) {
      throw new Error(`Connected to "${row.database}" but expected "${desiredName}"`);
    }
    return row;
  });

  return { created, identity };
}

function mapEnvLine(line: string, key: string, transform: (url: URL) => void): string {
  if (!line.startsWith(`${key}=`)) {
    return line;
  }
  const raw = line.slice(key.length + 1).trim();
  if (!raw || raw.startsWith("#")) {
    return line;
  }
  const parsed = new URL(raw);
  transform(parsed);
  return `${key}=${parsed.toString()}`;
}

function repairCorruptedUsernames(url: URL): void {
  if (url.username === "strangeup_dev_owner" || url.username === "strangeup_test_owner") {
    url.username = "neondb_owner";
  }
}

function setCatalogPath(database: string): (url: URL) => void {
  return (url) => {
    const current = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (current === database) {
      return;
    }
    if (current !== "neondb") {
      throw new Error(`Catalog "${current}" is not an expected bootstrap target`);
    }
    url.pathname = `/${database}`;
  };
}

function rewriteEnvFile(envPath: string, mode: "repair-user" | "retarget-catalog"): void {
  const original = readFileSync(envPath, "utf8");
  const lines = original.split(/\r?\n/);
  const next = lines.map((line) => {
    if (line.includes("Native PostgreSQL 18 (active)")) {
      return "# --- Neon PostgreSQL (active) — pooler URLs; migrate via scripts/apply-migrations-neon.ts ---";
    }
    if (mode === "repair-user") {
      if (line.startsWith("DATABASE_URL=") || line.startsWith("INTEGRATION_DATABASE_URL=")) {
        const key = line.startsWith("DATABASE_URL=") ? "DATABASE_URL" : "INTEGRATION_DATABASE_URL";
        return mapEnvLine(line, key, repairCorruptedUsernames);
      }
      return line;
    }
    if (line.startsWith("DATABASE_URL=")) {
      return mapEnvLine(line, "DATABASE_URL", setCatalogPath(REQUIRED_DEVELOPMENT_DATABASE));
    }
    if (line.startsWith("INTEGRATION_DATABASE_URL=")) {
      return mapEnvLine(
        line,
        "INTEGRATION_DATABASE_URL",
        setCatalogPath(REQUIRED_INTEGRATION_DATABASE),
      );
    }
    return line;
  });
  if (next.join("\n") !== original) {
    writeFileSync(envPath, next.join("\n"), "utf8");
  }
}

function reloadDotenv(envPath: string): void {
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = /^(DATABASE_URL|INTEGRATION_DATABASE_URL)=(.*)$/.exec(line);
    if (match) {
      process.env[match[1]] = match[2];
    }
  }
}

async function main(): Promise<void> {
  const envPath = resolve(process.cwd(), ".env");
  rewriteEnvFile(envPath, "repair-user");
  reloadDotenv(envPath);

  const bootstrapDev = requireEnv("DATABASE_URL");
  const bootstrapTest = requireEnv("INTEGRATION_DATABASE_URL");

  const dev = parseDatabaseTarget(bootstrapDev);
  const test = parseDatabaseTarget(bootstrapTest);

  console.log("Dev URL (redacted):", redactDatabaseUrl(bootstrapDev));
  console.log("Integration URL (redacted):", redactDatabaseUrl(bootstrapTest));

  if (dev.hostname === test.hostname && dev.port === test.port) {
    throw new Error("DATABASE_URL and INTEGRATION_DATABASE_URL must use isolated Neon endpoints");
  }

  const devResult = await ensureNamedDatabase(bootstrapDev, REQUIRED_DEVELOPMENT_DATABASE);
  const testResult = await ensureNamedDatabase(bootstrapTest, REQUIRED_INTEGRATION_DATABASE);

  rewriteEnvFile(envPath, "retarget-catalog");
  reloadDotenv(envPath);

  console.log(
    `Development catalog: ${devResult.identity.database} user=${devResult.identity.user} created=${devResult.created}`,
  );
  console.log(
    `Integration catalog: ${testResult.identity.database} user=${testResult.identity.user} created=${testResult.created}`,
  );
  console.log("Dev URL after retarget (redacted):", redactDatabaseUrl(requireEnv("DATABASE_URL")));
  console.log(
    "Integration URL after retarget (redacted):",
    redactDatabaseUrl(requireEnv("INTEGRATION_DATABASE_URL")),
  );

  if (devResult.identity.database === testResult.identity.database) {
    throw new Error("Development and integration catalogs must be different");
  }

  console.log("Named Neon catalogs are ready.");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
