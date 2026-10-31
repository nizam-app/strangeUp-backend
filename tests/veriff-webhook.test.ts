import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";
import { VerificationService } from "../src/modules/verification/verification.service.js";
import { computeHmacSha256Hex } from "../src/modules/verification/webhook-signature.js";
import type { DatabaseClient } from "../src/infrastructure/database/prisma.js";

const API_KEY = "8e4f7cd8-7a19-4d7d-971f-a076407ee03c";
const SHARED_SECRET = "test-shared-secret-min-32-characters!!";

function buildVeriffEnv() {
  return loadEnv({
    NODE_ENV: "test",
    KYC_PROVIDER_ENABLED: "true",
    KYC_PROVIDER: "veriff",
    VERIFF_API_KEY: API_KEY,
    VERIFF_SHARED_SECRET: SHARED_SECRET,
    VERIFF_API_BASE_URL: "https://stationapi.veriff.com",
    VERIFF_LIVE_CALLS_ENABLED: "true",
  });
}

function minimalDecisionPayload(overrides: Record<string, unknown> = {}) {
  return {
    status: "success",
    verification: {
      id: "123e4567-e89b-12d3-a456-426614174000",
      status: "approved",
      decisionTime: "2019-11-06T07:18:36.916Z",
      endUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      person: { firstName: "SHOULD_NOT_PERSIST" },
    },
    ...overrides,
  };
}

describe("Veriff webhook processing", () => {
  it("rejects webhooks when Veriff live activation is off", async () => {
    const env = loadEnv({
      NODE_ENV: "test",
      KYC_PROVIDER_ENABLED: "true",
      KYC_PROVIDER: "veriff",
      VERIFF_API_KEY: API_KEY,
      VERIFF_SHARED_SECRET: SHARED_SECRET,
      VERIFF_API_BASE_URL: "https://stationapi.veriff.com",
      VERIFF_LIVE_CALLS_ENABLED: "false",
    });
    const service = new VerificationService({} as DatabaseClient, env);
    const raw = Buffer.from(JSON.stringify(minimalDecisionPayload()), "utf8");
    await expect(
      service.processVeriffWebhook(raw, computeHmacSha256Hex(SHARED_SECRET, raw), API_KEY),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });

  it("requires valid HMAC signature over the raw body", async () => {
    const service = new VerificationService({} as DatabaseClient, buildVeriffEnv());
    const raw = Buffer.from(JSON.stringify(minimalDecisionPayload()), "utf8");
    await expect(service.processVeriffWebhook(raw, "deadbeef", API_KEY)).rejects.toMatchObject({
      code: "AUTH_FORBIDDEN",
    });
  });

  it("requires matching x-auth-client API key", async () => {
    const service = new VerificationService({} as DatabaseClient, buildVeriffEnv());
    const raw = Buffer.from(JSON.stringify(minimalDecisionPayload()), "utf8");
    const sig = computeHmacSha256Hex(SHARED_SECRET, raw);
    await expect(service.processVeriffWebhook(raw, sig, "wrong-key")).rejects.toMatchObject({
      code: "AUTH_FORBIDDEN",
    });
  });
});
