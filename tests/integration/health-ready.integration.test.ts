import { describe, expect, it } from "vitest";
import request from "supertest";
import { createPrismaClient, disconnectPrisma } from "../../src/infrastructure/database/prisma.js";
import { createTestApp, buildTestEnv } from "../helpers/test-app.js";

const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL?.trim();
const runIntegration = process.env.RUN_INTEGRATION === "1" && Boolean(integrationDatabaseUrl);

describe.runIf(runIntegration)("integration: GET /health/ready", () => {
  it("returns 200 against a real PostgreSQL instance", async () => {
    const db = createPrismaClient(integrationDatabaseUrl!);
    const app = createTestApp({
      env: buildTestEnv({ DATABASE_URL: integrationDatabaseUrl }),
      db,
    });

    try {
      const res = await request(app).get("/health/ready");
      expect(res.status).toBe(200);
      expect(res.body.data.checks.database).toBe("up");
    } finally {
      await disconnectPrisma();
    }
  });
});

describe.runIf(!runIntegration)("integration: GET /health/ready (skipped)", () => {
  it("documents how to enable real DB integration tests", () => {
    expect(true).toBe(true);
  });
});
