import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";
import { assertProductionEnvironmentSafe } from "../src/config/production-env-policy.js";
import { buildTestEnv } from "./helpers/test-app.js";

const PRODUCTION_BASE = {
  NODE_ENV: "production" as const,
  DATABASE_URL:
    "postgresql://user:pass@ep-example.us-east-1.aws.neon.tech/strangeup_dev?sslmode=require",
  CORS_ORIGINS: "https://app.example.com",
  JWT_ACCESS_SECRET: "production-jwt-secret-with-sufficient-entropy-32",
  PUBLIC_APP_BASE_URL: "https://app.example.com",
  PROFILE_UPLOAD_DIR: "/var/strangeup/profile-media",
  ACTIVITY_UPLOAD_DIR: "/var/strangeup/activity-media",
  GROUP_UPLOAD_DIR: "/var/strangeup/group-media",
  STORE_UPLOAD_DIR: "/var/strangeup/store-media",
  KYC_PROVIDER_ENABLED: "false" as const,
  GROUP_COMMUNITY_INTERACTIVE_ENABLED: "false" as const,
  TRANSACTIONAL_EMAIL_MODE: "disabled" as const,
  RATE_LIMIT_STORE: "fail_closed" as const,
};

describe("production environment safeguards (Task 018)", () => {
  it("accepts a minimal safe production configuration", () => {
    const env = loadEnv(PRODUCTION_BASE);
    expect(env.isProduction).toBe(true);
    expect(env.auth.PUBLIC_APP_BASE_URL).toBe("https://app.example.com");
  });

  it("rejects placeholder JWT secrets", () => {
    expect(() =>
      loadEnv({
        ...PRODUCTION_BASE,
        JWT_ACCESS_SECRET: "change-me-to-at-least-32-random-characters",
      }),
    ).toThrow(/Unsafe production environment/);
  });

  it("rejects localhost CORS in production", () => {
    expect(() =>
      loadEnv({
        ...PRODUCTION_BASE,
        CORS_ORIGINS: "http://localhost:3000",
      }),
    ).toThrow(/CORS_ORIGINS must not include localhost/);
  });

  it("rejects D-06 interactive media flag in production", () => {
    expect(() =>
      loadEnv({
        ...PRODUCTION_BASE,
        GROUP_COMMUNITY_INTERACTIVE_ENABLED: "true",
      }),
    ).toThrow(/GROUP_COMMUNITY_INTERACTIVE_ENABLED/);
  });

  it("rejects store catalog management flag in production", () => {
    expect(() =>
      loadEnv({
        ...PRODUCTION_BASE,
        STORE_CATALOG_MANAGEMENT_ENABLED: "true",
      }),
    ).toThrow(/STORE_CATALOG_MANAGEMENT_ENABLED/);
  });

  it("rejects KYC provider enablement without vendor integration", () => {
    expect(() =>
      loadEnv({
        ...PRODUCTION_BASE,
        KYC_PROVIDER_ENABLED: "true",
      }),
    ).toThrow(/KYC_PROVIDER_ENABLED/);
  });

  it("rejects default .data upload directories in production", () => {
    expect(() =>
      loadEnv({
        ...PRODUCTION_BASE,
        PROFILE_UPLOAD_DIR: ".data/profile-media",
      }),
    ).toThrow(/upload directories must not use local .data paths/);
  });

  it("accepts production when MEDIA_STORAGE_BACKEND=s3 and credentials are configured", () => {
    const env = loadEnv({
      ...PRODUCTION_BASE,
      MEDIA_STORAGE_BACKEND: "s3",
      MEDIA_S3_BUCKET: "strangeup-prod-media-private",
      MEDIA_S3_REGION: "auto",
      MEDIA_S3_ENDPOINT: "https://example.r2.cloudflarestorage.com",
      MEDIA_S3_ACCESS_KEY_ID: "AKIA_PRODUCTION_KEY_ID",
      MEDIA_S3_SECRET_ACCESS_KEY: "super-secret-access-key-value",
      MEDIA_S3_FORCE_PATH_STYLE: "true",
    });
    expect(env.MEDIA_STORAGE_BACKEND).toBe("s3");
  });

  it("rejects placeholder S3 bucket in production", () => {
    expect(() =>
      loadEnv({
        ...PRODUCTION_BASE,
        MEDIA_STORAGE_BACKEND: "s3",
        MEDIA_S3_BUCKET: "your-bucket",
        MEDIA_S3_REGION: "us-east-1",
        MEDIA_S3_ACCESS_KEY_ID: "AKIA_PRODUCTION_KEY_ID",
        MEDIA_S3_SECRET_ACCESS_KEY: "super-secret-access-key-value",
      }),
    ).toThrow(/Unsafe production media storage/);
  });

  it("requires PUBLIC_APP_BASE_URL in production", () => {
    const input = { ...PRODUCTION_BASE };
    delete (input as { PUBLIC_APP_BASE_URL?: string }).PUBLIC_APP_BASE_URL;
    expect(() => loadEnv(input)).toThrow(/PUBLIC_APP_BASE_URL is required/);
  });

  it("rejects dev_stub transactional email in production", () => {
    expect(() =>
      loadEnv({
        ...PRODUCTION_BASE,
        TRANSACTIONAL_EMAIL_MODE: "dev_stub",
      }),
    ).toThrow(/TRANSACTIONAL_EMAIL_MODE=dev_stub is not allowed/);
  });

  it("rejects in-memory rate limit store in production", () => {
    expect(() =>
      loadEnv({
        ...PRODUCTION_BASE,
        RATE_LIMIT_STORE: "memory",
      }),
    ).toThrow(/RATE_LIMIT_STORE=memory is not allowed/);
  });

  it("assertProductionEnvironmentSafe is a no-op outside production", () => {
    const env = buildTestEnv({ isProduction: false, NODE_ENV: "test" });
    expect(() =>
      assertProductionEnvironmentSafe(env, "test-jwt-access-secret-min-32-chars!!"),
    ).not.toThrow();
  });
});
