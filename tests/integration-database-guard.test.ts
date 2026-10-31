import { describe, expect, it } from "vitest";
import {
  REQUIRED_INTEGRATION_DATABASE,
  assertIntegrationDatabaseUrlPolicy,
  assertManualKycTestApiDatabaseUrl,
  normalizeDatabaseTarget,
  redactDatabaseUrl,
  resolveManualKycTestDatabaseUrl,
  toNeonDirectConnectionString,
  withDatabaseName,
} from "./setup/integration-database-guard.js";

describe("integration database guard", () => {
  it("allows native strangeup_test separate from strangeup_dev", () => {
    const dev = "postgresql://strangeup:@localhost:5432/strangeup_dev?schema=public";
    const test = "postgresql://strangeup:@localhost:5432/strangeup_test?schema=public";
    assertIntegrationDatabaseUrlPolicy(test, dev);
    expect(normalizeDatabaseTarget(test)).toBe("localhost:5432/strangeup_test");
  });

  it("rejects integration on strangeup_dev", () => {
    const url = "postgresql://strangeup:@localhost:5432/strangeup_dev?schema=public";
    expect(() => assertIntegrationDatabaseUrlPolicy(url)).toThrow(REQUIRED_INTEGRATION_DATABASE);
  });

  it("rejects Prisma Dev port for integration", () => {
    const url = "postgresql://postgres:postgres@localhost:51214/strangeup_test?sslmode=disable";
    expect(() => assertIntegrationDatabaseUrlPolicy(url)).toThrow("Prisma Dev port");
  });

  it("rejects same database for dev and integration", () => {
    const url = "postgresql://strangeup:@localhost:5432/strangeup_test?schema=public";
    expect(() => assertIntegrationDatabaseUrlPolicy(url, url)).toThrow("must not match");
  });

  it("rejects default Neon catalog neondb for integration", () => {
    const url =
      "postgresql://neondb_owner@ep-test-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
    expect(() => assertIntegrationDatabaseUrlPolicy(url)).toThrow(REQUIRED_INTEGRATION_DATABASE);
  });

  it("allows isolated Neon strangeup_test separate from strangeup_dev", () => {
    const dev =
      "postgresql://neondb_owner@ep-dev-pooler.c-3.ap-southeast-1.aws.neon.tech/strangeup_dev?sslmode=require";
    const test =
      "postgresql://neondb_owner@ep-test-pooler.c-3.ap-southeast-1.aws.neon.tech/strangeup_test?sslmode=require";
    assertIntegrationDatabaseUrlPolicy(test, dev);
  });

  it("strips Neon pooler hostname for direct migrations", () => {
    const pooled =
      "postgresql://neondb_owner@ep-dev-pooler.c-3.ap-southeast-1.aws.neon.tech/strangeup_dev?sslmode=require";
    expect(toNeonDirectConnectionString(pooled)).toContain(
      "ep-dev.c-3.ap-southeast-1.aws.neon.tech/strangeup_dev",
    );
    expect(toNeonDirectConnectionString(pooled)).not.toContain("-pooler.");
  });

  it("retargets only the catalog path, not a username containing neondb", () => {
    const url =
      "postgresql://neondb_owner:secret@ep-dev-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
    const next = withDatabaseName(url, "strangeup_dev");
    expect(next).toContain("neondb_owner");
    expect(next).toContain("/strangeup_dev?");
    expect(next).not.toContain("strangeup_dev_owner");
    expect(next).not.toContain("/neondb?");
  });

  it("assertManualKycTestApiDatabaseUrl allows strangeup_test only", () => {
    const test =
      "postgresql://user@ep-test-pooler.c-3.ap-southeast-1.aws.neon.tech/strangeup_test?sslmode=require";
    assertManualKycTestApiDatabaseUrl(test);
    const dev =
      "postgresql://user@ep-dev-pooler.c-3.ap-southeast-1.aws.neon.tech/strangeup_dev?sslmode=require";
    expect(() => assertManualKycTestApiDatabaseUrl(dev)).toThrow("strangeup_test");
  });

  it("resolveManualKycTestDatabaseUrl uses INTEGRATION_DATABASE_URL", () => {
    const integration =
      "postgresql://user@ep-test-pooler.c-3.ap-southeast-1.aws.neon.tech/strangeup_test?sslmode=require";
    const resolved = resolveManualKycTestDatabaseUrl({
      MANUAL_KYC_TEST_DATABASE_SOURCE: "integration",
      INTEGRATION_DATABASE_URL: integration,
    });
    expect(resolved).toBe(integration);
  });

  it("redacts credentials from database URLs", () => {
    const url =
      "postgresql://neondb_owner:super-secret@ep-dev-pooler.c-3.ap-southeast-1.aws.neon.tech/strangeup_dev?sslmode=require";
    const redacted = redactDatabaseUrl(url);
    expect(redacted).toContain("neondb_owner@");
    expect(redacted).toContain("/strangeup_dev");
    expect(redacted).not.toContain("super-secret");
  });
});
