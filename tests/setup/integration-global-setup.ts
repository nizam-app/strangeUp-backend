import "dotenv/config";
import {
  assertIntegrationDatabaseUrlPolicy,
  verifyIntegrationDatabaseIdentity,
} from "./integration-database-guard.js";

export async function setup(): Promise<void> {
  if (process.env.RUN_INTEGRATION !== "1") {
    return;
  }

  const integrationUrl = process.env.INTEGRATION_DATABASE_URL?.trim();
  if (!integrationUrl) {
    throw new Error(
      "RUN_INTEGRATION=1 requires INTEGRATION_DATABASE_URL (integration tests must not use DATABASE_URL)",
    );
  }

  const devUrl = process.env.DATABASE_URL?.trim();
  assertIntegrationDatabaseUrlPolicy(integrationUrl, devUrl);

  try {
    const identity = await verifyIntegrationDatabaseIdentity(integrationUrl);
    process.env.INTEGRATION_DATABASE_VERIFIED = `${identity.database}@${identity.user}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Integration database health/identity check failed: ${message}. ` +
        "See docs/operations/NEON_POSTGRES.md",
      { cause: err },
    );
  }
}
