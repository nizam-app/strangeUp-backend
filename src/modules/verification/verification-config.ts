import type { AppEnv } from "../../config/env.js";
import type { VerificationProvider } from "../../../generated/prisma/client.js";

export type KycProviderRuntimeStatus =
  "NOT_CONFIGURED" | "FEATURE_DISABLED" | "MOCK" | "VERIFF_BLOCKED_BY_OWNER" | "VERIFF_READY";

export type VerificationRuntimeConfig = {
  providerEnabled: boolean;
  provider: VerificationProvider | null;
  runtimeStatus: KycProviderRuntimeStatus;
  webhookBodyLimitBytes: number;
  sessionTtlSeconds: number;
  mockWebhookSecret?: string;
  veriffApiKey?: string;
  veriffSharedSecret?: string;
  veriffBaseUrl?: string;
  veriffLiveCallsAllowed: boolean;
};

const ALLOWED_VERIFF_BASE_URLS = new Set([
  "https://stationapi.veriff.com",
  "https://stationapi.veriff.me",
]);

export function resolveVerificationRuntimeConfig(env: AppEnv): VerificationRuntimeConfig {
  const providerEnabled = env.KYC_PROVIDER_ENABLED;
  const providerKind = env.KYC_PROVIDER;

  if (!providerEnabled || providerKind === "none") {
    return {
      providerEnabled: false,
      provider: null,
      runtimeStatus: providerEnabled ? "NOT_CONFIGURED" : "FEATURE_DISABLED",
      webhookBodyLimitBytes: env.KYC_WEBHOOK_BODY_LIMIT_BYTES,
      sessionTtlSeconds: env.KYC_SESSION_TTL_SECONDS,
      veriffLiveCallsAllowed: false,
    };
  }

  if (providerKind === "mock") {
    return {
      providerEnabled: true,
      provider: "MOCK",
      runtimeStatus: "MOCK",
      webhookBodyLimitBytes: env.KYC_WEBHOOK_BODY_LIMIT_BYTES,
      sessionTtlSeconds: env.KYC_SESSION_TTL_SECONDS,
      mockWebhookSecret: env.KYC_MOCK_WEBHOOK_HMAC_SECRET,
      veriffLiveCallsAllowed: false,
    };
  }

  if (providerKind === "veriff") {
    const baseUrl = env.VERIFF_API_BASE_URL?.trim();
    const hasCreds =
      Boolean(env.VERIFF_API_KEY?.trim()) && Boolean(env.VERIFF_SHARED_SECRET?.trim());
    const baseAllowed = baseUrl ? ALLOWED_VERIFF_BASE_URLS.has(baseUrl) : false;
    const liveAllowed = env.VERIFF_LIVE_CALLS_ENABLED === true;

    return {
      providerEnabled: true,
      provider: "VERIFF",
      runtimeStatus:
        hasCreds && baseAllowed && liveAllowed ? "VERIFF_READY" : "VERIFF_BLOCKED_BY_OWNER",
      webhookBodyLimitBytes: env.KYC_WEBHOOK_BODY_LIMIT_BYTES,
      sessionTtlSeconds: env.KYC_SESSION_TTL_SECONDS,
      veriffApiKey: env.VERIFF_API_KEY,
      veriffSharedSecret: env.VERIFF_SHARED_SECRET,
      veriffBaseUrl: baseUrl,
      veriffLiveCallsAllowed: liveAllowed,
    };
  }

  return {
    providerEnabled: true,
    provider: null,
    runtimeStatus: "NOT_CONFIGURED",
    webhookBodyLimitBytes: env.KYC_WEBHOOK_BODY_LIMIT_BYTES,
    sessionTtlSeconds: env.KYC_SESSION_TTL_SECONDS,
    veriffLiveCallsAllowed: false,
  };
}

export function canStartVerificationSession(config: VerificationRuntimeConfig): boolean {
  return (
    config.providerEnabled &&
    (config.runtimeStatus === "MOCK" || config.runtimeStatus === "VERIFF_READY")
  );
}
