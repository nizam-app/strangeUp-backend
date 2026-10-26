import "dotenv/config";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.LOG_LEVEL = "silent";

function normalizeDatabaseTarget(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.password = "";
    return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
  } catch {
    return "[invalid-url]";
  }
}

if (process.env.RUN_INTEGRATION === "1") {
  const integrationUrl = process.env.INTEGRATION_DATABASE_URL?.trim();
  if (!integrationUrl) {
    throw new Error(
      "RUN_INTEGRATION=1 requires INTEGRATION_DATABASE_URL (integration tests must not use DATABASE_URL)",
    );
  }

  const devUrl = process.env.DATABASE_URL?.trim();
  if (devUrl && normalizeDatabaseTarget(devUrl) === normalizeDatabaseTarget(integrationUrl)) {
    throw new Error(
      "INTEGRATION_DATABASE_URL must point at a separate test database (must not match DATABASE_URL)",
    );
  }
}
