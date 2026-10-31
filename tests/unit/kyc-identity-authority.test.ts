import { describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env.js";
import {
  buildKycEnforcementContext,
  resolveKycIdentityAuthority,
} from "../../src/modules/verification/kyc-identity-authority.js";

describe("kyc identity authority (031I-M1)", () => {
  it("defaults to none with both paths disabled", () => {
    const env = loadEnv({ NODE_ENV: "test" });
    const authority = resolveKycIdentityAuthority(env);
    expect(authority.activePath).toBe("none");
    expect(authority.providerSessionStartAllowed).toBe(false);
    expect(authority.manualReviewAllowed).toBe(false);
  });

  it("allows manual path only when Cloudinary is configured in test", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      KYC_IDENTITY_AUTHORITY: "manual",
      KYC_MANUAL_REVIEW_ENABLED: "true",
      CLOUDINARY_CLOUD_NAME: "demo",
      CLOUDINARY_API_KEY: "123456789012345",
      CLOUDINARY_API_SECRET: "test-cloudinary-api-secret-min-32-chars",
    });
    const authority = resolveKycIdentityAuthority(env);
    expect(authority.activePath).toBe("manual");
    expect(authority.providerSessionStartAllowed).toBe(false);
    expect(authority.manualReviewAllowed).toBe(true);
    expect(buildKycEnforcementContext(env).kycManualReviewEnabled).toBe(true);
  });

  it("rejects simultaneous provider enabled and manual authority", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "test",
        KYC_IDENTITY_AUTHORITY: "manual",
        KYC_PROVIDER_ENABLED: "true",
        KYC_PROVIDER: "mock",
        KYC_MOCK_WEBHOOK_HMAC_SECRET: "test-mock-webhook-hmac-secret-min-32",
        CLOUDINARY_CLOUD_NAME: "demo",
        CLOUDINARY_API_KEY: "123456789012345",
        CLOUDINARY_API_SECRET: "test-cloudinary-api-secret-min-32-chars",
      }),
    ).toThrow(/distinct authority paths/);
  });
});
