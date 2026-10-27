import "dotenv/config";

import { assertIntegrationDatabaseUrlPolicy } from "./integration-database-guard.js";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.LOG_LEVEL = "silent";

if (process.env.RUN_INTEGRATION === "1") {
  const integrationUrl = process.env.INTEGRATION_DATABASE_URL?.trim();
  if (!integrationUrl) {
    throw new Error(
      "RUN_INTEGRATION=1 requires INTEGRATION_DATABASE_URL (integration tests must not use DATABASE_URL)",
    );
  }

  const devUrl = process.env.DATABASE_URL?.trim();
  assertIntegrationDatabaseUrlPolicy(integrationUrl, devUrl);
}
