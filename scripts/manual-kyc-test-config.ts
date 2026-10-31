/**
 * Manual KYC sandbox config helpers (Task 031J-1). Never logs secrets or full DATABASE_URL.
 */
import { config as loadDotenv } from "dotenv";
import { createHash } from "node:crypto";
import { loadEnv } from "../src/config/env.js";
import {
  assertManualKycTestApiDatabaseUrl,
  redactDatabaseUrl,
  resolveManualKycTestDatabaseUrl,
  verifyIntegrationDatabaseIdentity,
} from "../tests/setup/integration-database-guard.js";

export const MANUAL_KYC_TEST_LOCAL_ENV = ".env.manual-kyc-test.local";
export const MANUAL_KYC_TEST_DEFAULT_PORT = 3010;

function fingerprint(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12);
}

export function maskSecret(value: string | undefined): "unset" | "set" {
  if (!value?.trim()) {
    return "unset";
  }
  return "set";
}

export function maskSecretFingerprint(value: string | undefined): string {
  if (!value?.trim()) {
    return "[unset]";
  }
  const v = value.trim().replace(/^["']|["']$/g, "");
  return `[set:sha256:${fingerprint(v)}]`;
}

/** Base .env then test overlay (overlay wins). */
export function loadManualKycTestProcessEnv(): NodeJS.ProcessEnv {
  loadDotenv({ path: ".env" });
  const overlay = loadDotenv({ path: MANUAL_KYC_TEST_LOCAL_ENV, override: true });
  if (overlay.error) {
    throw new Error(
      `Missing ${MANUAL_KYC_TEST_LOCAL_ENV}. Copy .env.manual-kyc-test.example and configure Cloudinary + ports.`,
    );
  }
  return process.env;
}

export type ManualKycTestConfigAudit = {
  databaseRedacted: string;
  port: number;
  kycIdentityAuthority: string | undefined;
  kycManualReviewEnabled: string | undefined;
  kycProviderEnabled: string | undefined;
  cloudinary: {
    cloudName: "unset" | "set";
    apiKey: "unset" | "set";
    apiSecret: string;
    evidenceFolder: string | undefined;
  };
  envValid: boolean;
  envErrors: string[];
};

export function auditManualKycTestConfig(env: NodeJS.ProcessEnv): ManualKycTestConfigAudit {
  const databaseUrl = resolveManualKycTestDatabaseUrl(env);
  assertManualKycTestApiDatabaseUrl(databaseUrl);

  const port = Number(env.PORT ?? MANUAL_KYC_TEST_DEFAULT_PORT);
  let envValid = false;
  const envErrors: string[] = [];
  process.env.DATABASE_URL = databaseUrl;
  try {
    loadEnv();
    envValid = true;
  } catch (err: unknown) {
    envErrors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    databaseRedacted: redactDatabaseUrl(databaseUrl),
    port,
    kycIdentityAuthority: env.KYC_IDENTITY_AUTHORITY,
    kycManualReviewEnabled: env.KYC_MANUAL_REVIEW_ENABLED,
    kycProviderEnabled: env.KYC_PROVIDER_ENABLED,
    cloudinary: {
      cloudName: maskSecret(env.CLOUDINARY_CLOUD_NAME),
      apiKey: maskSecret(env.CLOUDINARY_API_KEY),
      apiSecret: maskSecretFingerprint(env.CLOUDINARY_API_SECRET),
      evidenceFolder: env.CLOUDINARY_KYC_EVIDENCE_FOLDER,
    },
    envValid,
    envErrors,
  };
}

export async function assertManualKycTestRuntimeReady(env: NodeJS.ProcessEnv): Promise<void> {
  const databaseUrl = resolveManualKycTestDatabaseUrl(env);
  assertManualKycTestApiDatabaseUrl(databaseUrl);

  const port = Number(env.PORT ?? MANUAL_KYC_TEST_DEFAULT_PORT);
  if (port === 3000) {
    throw new Error(
      "Refusing Manual KYC test API on PORT=3000 (conflicts with default npm run dev on strangeup_dev)",
    );
  }

  process.env.DATABASE_URL = databaseUrl;
  process.env.PORT = String(port);

  const identity = await verifyIntegrationDatabaseIdentity(databaseUrl);
  if (identity.database !== "strangeup_test") {
    throw new Error(`Live database identity mismatch: ${identity.database}`);
  }

  loadEnv();
}
