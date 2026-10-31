/**
 * Fail-closed checks for integration test database targeting.
 * Integration tests TRUNCATE user data — never run against dev, default Neon `neondb`, or production.
 */

const PRISMA_DEV_PORTS = new Set(["51213", "51214", "51215", "51216"]);

const FORBIDDEN_INTEGRATION_DATABASES = new Set([
  "postgres",
  "template0",
  "template1",
  "strangeup_dev",
  "neondb",
  "production",
  "prod",
]);

/** Owner-approved integration catalog name (Neon or local PostgreSQL). */
export const REQUIRED_INTEGRATION_DATABASE = "strangeup_test";
export const REQUIRED_DEVELOPMENT_DATABASE = "strangeup_dev";

export type ParsedDatabaseTarget = {
  hostname: string;
  port: string;
  database: string;
  pathname: string;
};

export function parseDatabaseTarget(url: string): ParsedDatabaseTarget {
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, "") || "");
  return {
    hostname: parsed.hostname,
    port: parsed.port || "5432",
    database,
    pathname: parsed.pathname,
  };
}

export function normalizeDatabaseTarget(url: string): string {
  const { hostname, port, database } = parseDatabaseTarget(url);
  return `${hostname}:${port}/${database}`;
}

export function isNeonHostname(hostname: string): boolean {
  return hostname.endsWith(".neon.tech");
}

/** Prisma migrate deploy needs a Neon direct (non-pooler) session. */
export function toNeonDirectConnectionString(url: string): string {
  const parsed = new URL(url);
  if (isNeonHostname(parsed.hostname) && parsed.hostname.includes("-pooler.")) {
    parsed.hostname = parsed.hostname.replace("-pooler.", ".");
  }
  return parsed.toString();
}

export function redactDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, "") || "");
  const user = decodeURIComponent(parsed.username || "");
  const ssl = parsed.searchParams.get("sslmode") ?? "unspecified";
  const pooler = parsed.hostname.includes("-pooler.");
  return `${user}@${parsed.hostname}:${parsed.port || "5432"}/${database} sslmode=${ssl} pooler=${pooler}`;
}

const ALLOWED_NAMED_CATALOGS = new Set([
  REQUIRED_DEVELOPMENT_DATABASE,
  REQUIRED_INTEGRATION_DATABASE,
]);

/** Retarget a URL at an allowlisted catalog name (never logs the result). */
export function withDatabaseName(url: string, database: string): string {
  if (!ALLOWED_NAMED_CATALOGS.has(database)) {
    throw new Error(`Refusing to retarget unknown database "${database}"`);
  }
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

export function assertSafeMigrationCatalog(
  database: string,
  role: "development" | "integration",
): void {
  const expected =
    role === "development" ? REQUIRED_DEVELOPMENT_DATABASE : REQUIRED_INTEGRATION_DATABASE;
  if (database !== expected) {
    throw new Error(`Refusing to migrate ${role} catalog "${database}" (expected "${expected}")`);
  }
}

/** Synchronous URL policy checks (no network). */
export function assertIntegrationDatabaseUrlPolicy(integrationUrl: string, devUrl?: string): void {
  const integration = parseDatabaseTarget(integrationUrl);

  if (!integration.database) {
    throw new Error("INTEGRATION_DATABASE_URL must include a database name");
  }

  if (integration.database !== REQUIRED_INTEGRATION_DATABASE) {
    throw new Error(
      `Integration tests must use database "${REQUIRED_INTEGRATION_DATABASE}" (got "${integration.database}")`,
    );
  }

  if (FORBIDDEN_INTEGRATION_DATABASES.has(integration.database)) {
    throw new Error(`Integration database "${integration.database}" is not allowed`);
  }

  if (PRISMA_DEV_PORTS.has(integration.port)) {
    throw new Error(
      `Integration DATABASE_URL targets Prisma Dev port ${integration.port}; use Neon or native PostgreSQL`,
    );
  }

  if (devUrl?.trim()) {
    if (normalizeDatabaseTarget(devUrl) === normalizeDatabaseTarget(integrationUrl)) {
      throw new Error(
        "INTEGRATION_DATABASE_URL must point at a separate test database (must not match DATABASE_URL)",
      );
    }
    const dev = parseDatabaseTarget(devUrl);
    if (dev.database === integration.database) {
      throw new Error("INTEGRATION_DATABASE_URL must not share the development database name");
    }
  }
}

/**
 * Fail-closed URL policy for the isolated Manual KYC test API (Task 031J-1).
 * Runtime DATABASE_URL must target catalog strangeup_test only — never strangeup_dev.
 */
export function assertManualKycTestApiDatabaseUrl(databaseUrl: string): void {
  const target = parseDatabaseTarget(databaseUrl);
  if (!target.database) {
    throw new Error("Manual KYC test API DATABASE_URL must include a database name");
  }
  if (target.database !== REQUIRED_INTEGRATION_DATABASE) {
    throw new Error(
      `Manual KYC test API refuses catalog "${target.database}" (required "${REQUIRED_INTEGRATION_DATABASE}")`,
    );
  }
  if (FORBIDDEN_INTEGRATION_DATABASES.has(target.database)) {
    throw new Error(`Manual KYC test API catalog "${target.database}" is not allowed`);
  }
  if (PRISMA_DEV_PORTS.has(target.port)) {
    throw new Error(
      `Manual KYC test API DATABASE_URL targets Prisma Dev port ${target.port}; use Neon or native PostgreSQL`,
    );
  }
}

/** Resolve DATABASE_URL for manual KYC test API from owner-approved sources (no logging). */
export function resolveManualKycTestDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const source = env.MANUAL_KYC_TEST_DATABASE_SOURCE?.trim() || "integration";
  if (source === "integration") {
    const integration = env.INTEGRATION_DATABASE_URL?.trim();
    if (!integration) {
      throw new Error(
        "MANUAL_KYC_TEST_DATABASE_SOURCE=integration requires INTEGRATION_DATABASE_URL in base .env",
      );
    }
    assertManualKycTestApiDatabaseUrl(integration);
    return integration;
  }
  if (source === "explicit") {
    const explicit = env.DATABASE_URL?.trim();
    if (!explicit) {
      throw new Error(
        "MANUAL_KYC_TEST_DATABASE_SOURCE=explicit requires DATABASE_URL in .env.manual-kyc-test.local",
      );
    }
    assertManualKycTestApiDatabaseUrl(explicit);
    return explicit;
  }
  throw new Error(
    `Unknown MANUAL_KYC_TEST_DATABASE_SOURCE "${source}" (use "integration" or "explicit")`,
  );
}

/** Verify live server identity matches URL (async). */
export async function verifyIntegrationDatabaseIdentity(
  integrationUrl: string,
): Promise<{ database: string; user: string }> {
  const pg = await import("pg");
  const client = new pg.default.Client({ connectionString: integrationUrl });
  await client.connect();
  try {
    const result = await client.query<{ database: string; user: string }>(
      "SELECT current_database() AS database, current_user AS user",
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("Could not read database identity from PostgreSQL");
    }
    if (row.database !== REQUIRED_INTEGRATION_DATABASE) {
      throw new Error(
        `Connected database is "${row.database}" but integration requires "${REQUIRED_INTEGRATION_DATABASE}"`,
      );
    }
    return row;
  } finally {
    await client.end();
  }
}
