import { S3Client } from "@aws-sdk/client-s3";
import type { AppEnv } from "../../config/env.js";

const PLACEHOLDER_BUCKET = /^(your-bucket|change-me|example|placeholder|test-bucket)/i;
const PLACEHOLDER_CREDENTIAL = /^(change-me|your-|example|placeholder|xxx)/i;

export type ResolvedS3MediaConfig = {
  bucket: string;
  region: string;
  endpoint?: string;
  keyPrefix?: string;
  accessKeyId: string;
  secretAccessKey: string;
  requestTimeoutMs: number;
  maxRetries: number;
  forcePathStyle: boolean;
};

export function assertS3MediaConfigValidForProduction(config: ResolvedS3MediaConfig): void {
  const violations: string[] = [];

  if (!config.bucket.trim() || PLACEHOLDER_BUCKET.test(config.bucket)) {
    violations.push("MEDIA_S3_BUCKET must be a real private bucket name in production");
  }
  if (!config.region.trim()) {
    violations.push("MEDIA_S3_REGION is required in production when MEDIA_STORAGE_BACKEND=s3");
  }
  if (!config.accessKeyId.trim() || PLACEHOLDER_CREDENTIAL.test(config.accessKeyId)) {
    violations.push("MEDIA_S3_ACCESS_KEY_ID must not be a placeholder in production");
  }
  if (!config.secretAccessKey.trim() || PLACEHOLDER_CREDENTIAL.test(config.secretAccessKey)) {
    violations.push("MEDIA_S3_SECRET_ACCESS_KEY must not be a placeholder in production");
  }
  if (config.endpoint) {
    try {
      const url = new URL(config.endpoint);
      if (url.protocol !== "https:") {
        violations.push("MEDIA_S3_ENDPOINT must use https in production");
      }
    } catch {
      violations.push("MEDIA_S3_ENDPOINT must be a valid https URL when set");
    }
  }

  if (violations.length > 0) {
    throw new Error(`Unsafe production media storage configuration: ${violations.join("; ")}`);
  }
}

export function resolveS3MediaConfig(env: AppEnv): ResolvedS3MediaConfig {
  const bucket = env.MEDIA_S3_BUCKET?.trim() ?? "";
  const region = env.MEDIA_S3_REGION?.trim() ?? "";
  const accessKeyId = env.MEDIA_S3_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = env.MEDIA_S3_SECRET_ACCESS_KEY?.trim() ?? "";

  if (env.isProduction && env.MEDIA_STORAGE_BACKEND === "s3") {
    const missing: string[] = [];
    if (!bucket) missing.push("MEDIA_S3_BUCKET");
    if (!region) missing.push("MEDIA_S3_REGION");
    if (!accessKeyId) missing.push("MEDIA_S3_ACCESS_KEY_ID");
    if (!secretAccessKey) missing.push("MEDIA_S3_SECRET_ACCESS_KEY");
    if (missing.length > 0) {
      throw new Error(
        `Unsafe production media storage configuration: missing ${missing.join(", ")} when MEDIA_STORAGE_BACKEND=s3`,
      );
    }
  }

  if (env.MEDIA_STORAGE_BACKEND === "s3" && !env.isProduction) {
    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "MEDIA_STORAGE_BACKEND=s3 requires MEDIA_S3_BUCKET, MEDIA_S3_REGION, MEDIA_S3_ACCESS_KEY_ID, and MEDIA_S3_SECRET_ACCESS_KEY",
      );
    }
  }

  const config: ResolvedS3MediaConfig = {
    bucket,
    region,
    endpoint: env.MEDIA_S3_ENDPOINT?.trim() || undefined,
    keyPrefix: env.MEDIA_S3_KEY_PREFIX?.trim() || undefined,
    accessKeyId,
    secretAccessKey,
    requestTimeoutMs: env.MEDIA_S3_REQUEST_TIMEOUT_MS,
    maxRetries: env.MEDIA_S3_MAX_RETRIES,
    forcePathStyle: env.MEDIA_S3_FORCE_PATH_STYLE,
  };

  if (env.isProduction && env.MEDIA_STORAGE_BACKEND === "s3") {
    assertS3MediaConfigValidForProduction(config);
  }

  return config;
}

let sharedS3Client: S3Client | undefined;

export function getSharedS3Client(env: AppEnv): S3Client {
  if (env.MEDIA_STORAGE_BACKEND !== "s3") {
    throw new Error("S3 client requested while MEDIA_STORAGE_BACKEND is not s3");
  }
  if (!sharedS3Client) {
    const config = resolveS3MediaConfig(env);
    sharedS3Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return sharedS3Client;
}

/** Test hook — reset cached client between tests. */
export function resetSharedS3ClientForTests(): void {
  sharedS3Client = undefined;
}
