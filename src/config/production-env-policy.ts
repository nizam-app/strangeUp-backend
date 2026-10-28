import type { AppEnv } from "./env.js";

const WEAK_JWT_PATTERNS = [/^change-me/i, /^test-jwt-access-secret/i];

const DEFAULT_LOCAL_UPLOAD_DIRS = new Set([
  ".data/profile-media",
  ".data/activity-media",
  ".data/group-media",
  ".data/store-media",
]);

function normalizeUploadDir(dir: string): string {
  return dir.replace(/\\/g, "/").replace(/\/+$/, "");
}

function corsOriginIsLocalhost(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Fail closed when NODE_ENV=production — invoked from loadEnv after schema parse. */
export function assertProductionEnvironmentSafe(env: AppEnv, jwtSecret: string): void {
  if (!env.isProduction) {
    return;
  }

  const violations: string[] = [];

  if (jwtSecret.length < 32) {
    violations.push("JWT_ACCESS_SECRET must be at least 32 characters in production");
  }
  for (const pattern of WEAK_JWT_PATTERNS) {
    if (pattern.test(jwtSecret)) {
      violations.push("JWT_ACCESS_SECRET must not use a placeholder or test default in production");
      break;
    }
  }

  if (!env.auth.PUBLIC_APP_BASE_URL) {
    violations.push(
      "PUBLIC_APP_BASE_URL is required in production for trusted password-reset links",
    );
  }

  if (env.GROUP_COMMUNITY_INTERACTIVE_ENABLED) {
    violations.push(
      "GROUP_COMMUNITY_INTERACTIVE_ENABLED must remain false in production until D-06 owner approval",
    );
  }

  if (env.KYC_PROVIDER_ENABLED) {
    violations.push(
      "KYC_PROVIDER_ENABLED must remain false in production until an approved KYC vendor integration is configured",
    );
  }

  if (env.VERIFF_LIVE_CALLS_ENABLED) {
    violations.push(
      "VERIFF_LIVE_CALLS_ENABLED must remain false in production until owner approves Veriff (KYC-02)",
    );
  }

  if (env.KYC_PROVIDER === "veriff" && env.isProduction) {
    violations.push(
      "KYC_PROVIDER=veriff is not authorized in production until owner approves Veriff",
    );
  }

  if (env.KYC_PROVIDER === "mock" && env.isProduction) {
    violations.push("KYC_PROVIDER=mock is not allowed in production");
  }

  if (env.PUSH_ENABLED) {
    violations.push(
      "PUSH_ENABLED must remain false in production until Task 023D Firebase delivery is authorized",
    );
  }

  if (env.SOCKET_IO_REDIS_ADAPTER_ENABLED) {
    violations.push(
      "SOCKET_IO_REDIS_ADAPTER_ENABLED must remain false until Redis adapter security review completes",
    );
  }

  if (env.PLATFORM_IDENTITY_REVIEWER_USER_IDS?.trim()) {
    violations.push(
      "PLATFORM_IDENTITY_REVIEWER_USER_IDS must not be set in production; use controlled staff provisioning",
    );
  }

  for (const origin of env.corsOriginsList) {
    if (corsOriginIsLocalhost(origin)) {
      violations.push("CORS_ORIGINS must not include localhost in production");
      break;
    }
  }

  if (env.MEDIA_STORAGE_BACKEND === "local") {
    const uploadDirs = [
      env.PROFILE_UPLOAD_DIR,
      env.ACTIVITY_UPLOAD_DIR,
      env.GROUP_UPLOAD_DIR,
      env.STORE_UPLOAD_DIR,
    ];
    for (const dir of uploadDirs) {
      const normalized = normalizeUploadDir(dir);
      if (DEFAULT_LOCAL_UPLOAD_DIRS.has(normalized) || normalized.startsWith(".data/")) {
        violations.push(
          "Media upload directories must not use local .data paths in production (set MEDIA_STORAGE_BACKEND=s3 or non-local paths)",
        );
        break;
      }
    }
  } else if (env.MEDIA_STORAGE_BACKEND !== "s3") {
    violations.push("MEDIA_STORAGE_BACKEND must be local or s3 in production");
  }

  if (env.TRANSACTIONAL_EMAIL_MODE === "dev_stub") {
    violations.push(
      "TRANSACTIONAL_EMAIL_MODE=dev_stub is not allowed in production (use disabled or an approved provider)",
    );
  }

  if (env.TRANSACTIONAL_EMAIL_MODE === "provider") {
    if (!env.transactionalEmail.providerCredentialsPresent) {
      violations.push(
        "TRANSACTIONAL_EMAIL_MODE=provider requires RESEND_API_KEY and TRANSACTIONAL_EMAIL_FROM",
      );
    }
    if (!env.auth.PUBLIC_APP_BASE_URL) {
      violations.push(
        "PUBLIC_APP_BASE_URL is required when TRANSACTIONAL_EMAIL_MODE=provider in production",
      );
    }
  }

  if (env.RATE_LIMIT_STORE === "memory") {
    violations.push(
      "RATE_LIMIT_STORE=memory is not allowed in production (use fail_closed until Redis/Upstash is approved, then redis)",
    );
  }

  if (env.RATE_LIMIT_STORE === "redis" && !env.RATE_LIMIT_REDIS_URL?.trim()) {
    violations.push("RATE_LIMIT_REDIS_URL is required when RATE_LIMIT_STORE=redis in production");
  }

  if (env.RATE_LIMIT_STORE === "fail_closed" && env.RATE_LIMIT_REDIS_URL?.trim()) {
    violations.push(
      "RATE_LIMIT_REDIS_URL must not be set when RATE_LIMIT_STORE=fail_closed (misconfiguration)",
    );
  }

  if (violations.length > 0) {
    throw new Error(`Unsafe production environment configuration: ${violations.join("; ")}`);
  }
}
