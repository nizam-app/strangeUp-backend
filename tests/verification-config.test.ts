import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";
import {
  canStartVerificationSession,
  resolveVerificationRuntimeConfig,
} from "../src/modules/verification/verification-config.js";

describe("verification runtime config", () => {
  it("keeps Veriff blocked without credentials and live flag", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      KYC_PROVIDER_ENABLED: "true",
      KYC_PROVIDER: "veriff",
      VERIFF_API_KEY: "test-api-key",
      VERIFF_SHARED_SECRET: "test-shared-secret-min-32-characters!!",
      VERIFF_API_BASE_URL: "https://stationapi.veriff.com",
      VERIFF_LIVE_CALLS_ENABLED: "false",
    });
    const cfg = resolveVerificationRuntimeConfig(env);
    expect(cfg.runtimeStatus).toBe("VERIFF_BLOCKED_BY_OWNER");
    expect(canStartVerificationSession(cfg)).toBe(false);
  });

  it("marks Veriff ready only with sandbox credentials, allowlisted base URL, and live flag", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      KYC_PROVIDER_ENABLED: "true",
      KYC_PROVIDER: "veriff",
      VERIFF_API_KEY: "test-api-key",
      VERIFF_SHARED_SECRET: "test-shared-secret-min-32-characters!!",
      VERIFF_API_BASE_URL: "https://stationapi.veriff.com",
      VERIFF_LIVE_CALLS_ENABLED: "true",
    });
    const cfg = resolveVerificationRuntimeConfig(env);
    expect(cfg.runtimeStatus).toBe("VERIFF_READY");
    expect(canStartVerificationSession(cfg)).toBe(true);
    expect(cfg.veriffLiveCallsAllowed).toBe(true);
  });

  it("rejects non-allowlisted Veriff base URLs", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      KYC_PROVIDER_ENABLED: "true",
      KYC_PROVIDER: "veriff",
      VERIFF_API_KEY: "test-api-key",
      VERIFF_SHARED_SECRET: "test-shared-secret-min-32-characters!!",
      VERIFF_API_BASE_URL: "https://evil.example.com",
      VERIFF_LIVE_CALLS_ENABLED: "true",
    });
    const cfg = resolveVerificationRuntimeConfig(env);
    expect(cfg.runtimeStatus).toBe("VERIFF_BLOCKED_BY_OWNER");
  });

  it("keeps mock provider isolated for integration-style tests", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      KYC_PROVIDER_ENABLED: "true",
      KYC_PROVIDER: "mock",
      KYC_MOCK_WEBHOOK_HMAC_SECRET: "test-webhook-secret-min-32-characters!",
    });
    const cfg = resolveVerificationRuntimeConfig(env);
    expect(cfg.runtimeStatus).toBe("MOCK");
    expect(cfg.veriffLiveCallsAllowed).toBe(false);
    expect(canStartVerificationSession(cfg)).toBe(true);
  });
});
