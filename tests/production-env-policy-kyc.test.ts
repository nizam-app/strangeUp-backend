import { describe, expect, it } from "vitest";
import { assertProductionEnvironmentSafe } from "../src/config/production-env-policy.js";
import { loadEnv } from "../src/config/env.js";

function productionBaseEnv() {
  return loadEnv({
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/strangeup?schema=public",
    CORS_ORIGINS: "https://app.example.com",
    JWT_ACCESS_SECRET: "production-jwt-secret-minimum-32-chars",
    PUBLIC_APP_BASE_URL: "https://app.example.com",
    TRANSACTIONAL_EMAIL_MODE: "disabled",
    RATE_LIMIT_STORE: "fail_closed",
    MEDIA_STORAGE_BACKEND: "s3",
    MEDIA_S3_BUCKET: "strangeup-prod-media-private",
    MEDIA_S3_REGION: "auto",
    MEDIA_S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
    MEDIA_S3_ACCESS_KEY_ID: "key",
    MEDIA_S3_SECRET_ACCESS_KEY: "secret",
    PROFILE_UPLOAD_DIR: "/var/strangeup/profile-media",
    ACTIVITY_UPLOAD_DIR: "/var/strangeup/activity-media",
    GROUP_UPLOAD_DIR: "/var/strangeup/group-media",
    STORE_UPLOAD_DIR: "/var/strangeup/store-media",
  });
}

describe("production env policy — KYC / Veriff", () => {
  it("forbids mock provider and live Veriff in production startup", () => {
    const base = productionBaseEnv();

    expect(() =>
      assertProductionEnvironmentSafe(
        { ...base, KYC_PROVIDER: "mock", KYC_PROVIDER_ENABLED: true },
        base.auth.JWT_ACCESS_SECRET,
      ),
    ).toThrow(/KYC_PROVIDER=mock/);

    expect(() =>
      assertProductionEnvironmentSafe(
        {
          ...base,
          KYC_PROVIDER: "veriff",
          KYC_PROVIDER_ENABLED: true,
          VERIFF_LIVE_CALLS_ENABLED: true,
        },
        base.auth.JWT_ACCESS_SECRET,
      ),
    ).toThrow(/VERIFF_LIVE_CALLS_ENABLED/);

    expect(() =>
      assertProductionEnvironmentSafe(
        {
          ...base,
          KYC_IDENTITY_AUTHORITY: "manual",
          KYC_MANUAL_REVIEW_ENABLED: true,
        },
        base.auth.JWT_ACCESS_SECRET,
      ),
    ).toThrow(/Manual KYC/);
  });
});
