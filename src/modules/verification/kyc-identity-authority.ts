import type { AppEnv } from "../../config/env.js";
import type { KycEnforcementContext } from "./kyc-trust.js";
import { resolveCloudinaryKycConfig } from "../../infrastructure/kyc-evidence-storage/cloudinary-config.js";
import { resolveVerificationRuntimeConfig } from "./verification-config.js";

export type KycIdentityAuthorityPath = "none" | "provider" | "manual";

export type KycIdentityAuthorityResolution = {
  activePath: KycIdentityAuthorityPath;
  /** Provider (Veriff/mock) session start is allowed. */
  providerSessionStartAllowed: boolean;
  /** Manual review session + Cloudinary evidence is allowed. */
  manualReviewAllowed: boolean;
  /** Trusted KYC enforcement may accept manual-review approvals (non-production until owner enables). */
  manualReviewTrustedForEnforcement: boolean;
};

/**
 * Explicit authority paths — manual MVP does not reuse Veriff webhooks or spoof provider decisions.
 */
export function resolveKycIdentityAuthority(env: AppEnv): KycIdentityAuthorityResolution {
  const authority = env.KYC_IDENTITY_AUTHORITY;
  const providerConfig = resolveVerificationRuntimeConfig(env);
  const cloudinaryReady = resolveCloudinaryKycConfig(env) !== null;

  if (authority === "none") {
    return {
      activePath: "none",
      providerSessionStartAllowed: false,
      manualReviewAllowed: false,
      manualReviewTrustedForEnforcement: false,
    };
  }

  if (authority === "provider") {
    const providerReady =
      providerConfig.providerEnabled &&
      (providerConfig.runtimeStatus === "MOCK" || providerConfig.runtimeStatus === "VERIFF_READY");
    return {
      activePath: "provider",
      providerSessionStartAllowed: providerReady,
      manualReviewAllowed: false,
      manualReviewTrustedForEnforcement: false,
    };
  }

  const manualAllowed = cloudinaryReady;
  return {
    activePath: "manual",
    providerSessionStartAllowed: false,
    manualReviewAllowed: manualAllowed,
    manualReviewTrustedForEnforcement: manualAllowed && env.KYC_MANUAL_REVIEW_ENABLED,
  };
}

export function buildKycEnforcementContext(env: AppEnv): KycEnforcementContext {
  const authority = resolveKycIdentityAuthority(env);
  const providerConfig = resolveVerificationRuntimeConfig(env);
  return {
    isProduction: env.isProduction,
    kycProviderEnabled:
      authority.activePath === "provider" &&
      providerConfig.providerEnabled &&
      (providerConfig.runtimeStatus === "MOCK" || providerConfig.runtimeStatus === "VERIFF_READY"),
    kycManualReviewEnabled:
      authority.activePath === "manual" && authority.manualReviewTrustedForEnforcement,
  };
}
