import { z } from "zod";
import { assertProductionEnvironmentSafe } from "./production-env-policy.js";
import { resolveS3MediaConfig } from "../infrastructure/media-storage/s3-config.js";
import type { TransactionalEmailMode } from "../modules/auth/email-sender.js";

const nodeEnvSchema = z.enum(["development", "test", "production"]);

const transactionalEmailModeSchema = z.enum(["dev_stub", "disabled", "provider"]);
const rateLimitStoreSchema = z.enum(["memory", "redis", "fail_closed"]);
const mediaStorageBackendSchema = z.enum(["local", "s3"]);

const envSchema = z
  .object({
    NODE_ENV: nodeEnvSchema.default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1).optional(),
    CORS_ORIGINS: z.string().default("http://localhost:3000"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    JSON_BODY_LIMIT: z.string().default("100kb"),
    TRUST_PROXY: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    JWT_ACCESS_SECRET: z.string().min(32).optional(),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(3600)
      .max(60 * 60 * 24 * 90)
      .default(60 * 60 * 24 * 30),
    AUTH_CHALLENGE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(300)
      .max(60 * 60 * 24)
      .default(60 * 60 * 24),
    AUTH_RATE_LIMIT_LOGIN_PER_IP: z.coerce.number().int().min(1).max(1000).default(10),
    AUTH_RATE_LIMIT_LOGIN_PER_EMAIL: z.coerce.number().int().min(1).max(1000).default(5),
    AUTH_RATE_LIMIT_REGISTER_PER_IP: z.coerce.number().int().min(1).max(1000).default(10),
    AUTH_RATE_LIMIT_PASSWORD_RESET_PER_IP: z.coerce.number().int().min(1).max(1000).default(10),
    AUTH_RATE_LIMIT_PASSWORD_RESET_PER_EMAIL: z.coerce.number().int().min(1).max(1000).default(5),
    AUTH_RATE_LIMIT_EMAIL_VERIFY_PER_USER: z.coerce.number().int().min(1).max(1000).default(5),
    AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_IP: z.coerce.number().int().min(1).max(1000).default(10),
    AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_USER: z.coerce.number().int().min(1).max(1000).default(5),
    AUTH_RATE_LIMIT_EMAIL_CHANGE_PER_IP: z.coerce.number().int().min(1).max(1000).default(10),
    AUTH_RATE_LIMIT_EMAIL_CHANGE_PER_USER: z.coerce.number().int().min(1).max(1000).default(5),
    PUBLIC_APP_BASE_URL: z.string().url().optional(),
    PROFILE_UPLOAD_DIR: z.string().min(1).default(".data/profile-media"),
    ACTIVITY_UPLOAD_DIR: z.string().min(1).default(".data/activity-media"),
    GROUP_UPLOAD_DIR: z.string().min(1).default(".data/group-media"),
    STORE_UPLOAD_DIR: z.string().min(1).default(".data/store-media"),
    MEDIA_STORAGE_BACKEND: mediaStorageBackendSchema.default("local"),
    MEDIA_S3_BUCKET: z.string().min(1).optional(),
    MEDIA_S3_REGION: z.string().min(1).optional(),
    MEDIA_S3_ENDPOINT: z.string().url().optional(),
    MEDIA_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    MEDIA_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    MEDIA_S3_KEY_PREFIX: z.string().min(1).optional(),
    MEDIA_S3_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
    MEDIA_S3_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    MEDIA_S3_FORCE_PATH_STYLE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    KYC_PROVIDER_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    KYC_PROVIDER: z.enum(["none", "mock", "veriff"]).default("none"),
    KYC_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).default(3600),
    KYC_WEBHOOK_BODY_LIMIT_BYTES: z.coerce.number().int().min(1024).max(256_000).default(65_536),
    KYC_MOCK_WEBHOOK_HMAC_SECRET: z.string().min(32).optional(),
    VERIFF_API_KEY: z.string().min(1).optional(),
    VERIFF_SHARED_SECRET: z.string().min(32).optional(),
    VERIFF_API_BASE_URL: z.string().url().optional(),
    VERIFF_LIVE_CALLS_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    /** Task 031I-M1 — explicit identity authority (manual MVP vs provider); default none. */
    KYC_IDENTITY_AUTHORITY: z.enum(["none", "provider", "manual"]).default("none"),
    /** When authority=manual, enables trusted manual identity decisions outside production fail-closed. */
    KYC_MANUAL_REVIEW_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    KYC_MANUAL_EVIDENCE_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
    CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
    CLOUDINARY_API_KEY: z.string().min(1).optional(),
    /** Cloudinary dashboard secrets are often shorter than 32 chars; non-empty is enforced in manual authority refine. */
    CLOUDINARY_API_SECRET: z.string().min(1).optional(),
    CLOUDINARY_KYC_EVIDENCE_FOLDER: z.string().min(1).default("strangeup/kyc-evidence"),
    CLOUDINARY_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(15_000),
    CONSENT_ENFORCEMENT: z.enum(["strict", "placeholder_allowed"]).optional(),
    SOCIAL_RATE_LIMIT_FOLLOW_PER_USER: z.coerce.number().int().min(1).max(1000).default(20),
    SOCIAL_RATE_LIMIT_WAVE_PER_USER: z.coerce.number().int().min(1).max(1000).default(10),
    SOCIAL_RATE_LIMIT_REQUEST_PER_USER: z.coerce.number().int().min(1).max(1000).default(10),
    SOCIAL_RATE_LIMIT_MESSAGE_PER_USER: z.coerce.number().int().min(1).max(1000).default(40),
    GROUP_RATE_LIMIT_CREATE_PER_USER: z.coerce.number().int().min(1).max(1000).default(10),
    GROUP_RATE_LIMIT_JOIN_PER_USER: z.coerce.number().int().min(1).max(1000).default(20),
    GROUP_RATE_LIMIT_POST_PER_USER: z.coerce.number().int().min(1).max(1000).default(40),
    GROUP_RATE_LIMIT_MESSAGE_PER_USER: z.coerce.number().int().min(1).max(1000).default(40),
    GROUP_COMMUNITY_INTERACTIVE_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    GROUP_RATE_LIMIT_STORY_PER_USER: z.coerce.number().int().min(1).max(1000).default(20),
    GROUP_RATE_LIMIT_MEDIA_PER_USER: z.coerce.number().int().min(1).max(1000).default(40),
    GROUP_RATE_LIMIT_REPORT_PER_USER: z.coerce.number().int().min(1).max(1000).default(10),
    TRANSACTIONAL_EMAIL_MODE: transactionalEmailModeSchema.default("dev_stub"),
    TRANSACTIONAL_EMAIL_FROM: z.string().email().optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    RATE_LIMIT_STORE: rateLimitStoreSchema.default("memory"),
    RATE_LIMIT_REDIS_URL: z.string().min(1).optional(),
    RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(100)
      .max(30_000)
      .default(2_000),
    RESEND_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
    RESEND_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    /** Comma-separated user UUIDs granted SUPER_ADMIN (non-production bootstrap only). */
    PLATFORM_SUPER_ADMIN_USER_IDS: z.string().optional(),
    /** Comma-separated user UUIDs granted IDENTITY_REVIEWER (non-production bootstrap only). */
    PLATFORM_IDENTITY_REVIEWER_USER_IDS: z.string().optional(),
    /** Task 024B — staff catalog CRUD/media ingest (default off; production fail-closed until MKT-01/02). */
    STORE_CATALOG_MANAGEMENT_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    /** Comma-separated user UUIDs granted STORE_CATALOG_MANAGER (non-production bootstrap only). */
    PLATFORM_STORE_CATALOG_MANAGER_USER_IDS: z.string().optional(),
    SOCKET_IO_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
    SOCKET_IO_PATH: z.string().min(1).default("/socket.io"),
    /** Multi-instance pub/sub adapter — disabled until dedicated Redis config is verified (do not reuse rate-limit Redis blindly). */
    SOCKET_IO_REDIS_ADAPTER_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    SOCKET_IO_TYPING_MIN_INTERVAL_MS: z.coerce.number().int().min(500).max(10_000).default(2_000),
    SOCKET_IO_TYPING_TTL_MS: z.coerce.number().int().min(1_000).max(30_000).default(5_000),
    SOCKET_IO_ACCOUNT_RECHECK_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(2_000)
      .max(120_000)
      .default(15_000),
    /** Task 023C/023D — FCM delivery master switch (must stay false until 023D authorized). */
    PUSH_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    PUSH_WORKER_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
    PUSH_WORKER_INTERVAL_MS: z.coerce.number().int().min(1_000).max(300_000).default(5_000),
    PUSH_WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(200).default(20),
    PUSH_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
    PUSH_RETRY_BASE_MS: z.coerce.number().int().min(500).max(60_000).default(2_000),
    PUSH_OUTBOX_LOCK_TTL_MS: z.coerce.number().int().min(10_000).max(600_000).default(120_000),
    /** Skip FCM for notifications older than this (seconds). Prevents backlog flood when PUSH_ENABLED is turned on. 0 = no age limit. */
    PUSH_MAX_NOTIFICATION_AGE_SECONDS: z.coerce
      .number()
      .int()
      .min(0)
      .max(60 * 60 * 24 * 30)
      .default(86_400),
    /** Path to Firebase service account JSON (never commit; use secret mount in deployment). */
    FIREBASE_CREDENTIALS_FILE: z.string().min(1).optional(),
    FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.KYC_IDENTITY_AUTHORITY === "provider" && !data.KYC_PROVIDER_ENABLED) {
      ctx.addIssue({
        code: "custom",
        message:
          "KYC_IDENTITY_AUTHORITY=provider requires KYC_PROVIDER_ENABLED=true and a configured adapter",
        path: ["KYC_IDENTITY_AUTHORITY"],
      });
    }
    if (data.KYC_IDENTITY_AUTHORITY === "manual" && data.KYC_PROVIDER_ENABLED) {
      ctx.addIssue({
        code: "custom",
        message:
          "KYC_IDENTITY_AUTHORITY=manual requires KYC_PROVIDER_ENABLED=false (distinct authority paths)",
        path: ["KYC_IDENTITY_AUTHORITY"],
      });
    }
    if (data.KYC_IDENTITY_AUTHORITY === "manual") {
      const hasCloudinary =
        Boolean(data.CLOUDINARY_CLOUD_NAME?.trim()) &&
        Boolean(data.CLOUDINARY_API_KEY?.trim()) &&
        Boolean(data.CLOUDINARY_API_SECRET?.trim());
      if (data.NODE_ENV !== "test" && !hasCloudinary) {
        ctx.addIssue({
          code: "custom",
          message:
            "KYC_IDENTITY_AUTHORITY=manual requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET",
          path: ["KYC_IDENTITY_AUTHORITY"],
        });
      }
    }
  })
  .strict();

const KNOWN_ENV_KEYS = [
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "CORS_ORIGINS",
  "LOG_LEVEL",
  "JSON_BODY_LIMIT",
  "TRUST_PROXY",
  "JWT_ACCESS_SECRET",
  "JWT_ACCESS_TTL_SECONDS",
  "REFRESH_TOKEN_TTL_SECONDS",
  "AUTH_CHALLENGE_TTL_SECONDS",
  "AUTH_RATE_LIMIT_LOGIN_PER_IP",
  "AUTH_RATE_LIMIT_LOGIN_PER_EMAIL",
  "AUTH_RATE_LIMIT_REGISTER_PER_IP",
  "AUTH_RATE_LIMIT_PASSWORD_RESET_PER_IP",
  "AUTH_RATE_LIMIT_PASSWORD_RESET_PER_EMAIL",
  "AUTH_RATE_LIMIT_EMAIL_VERIFY_PER_USER",
  "AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_IP",
  "AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_USER",
  "AUTH_RATE_LIMIT_EMAIL_CHANGE_PER_IP",
  "AUTH_RATE_LIMIT_EMAIL_CHANGE_PER_USER",
  "PUBLIC_APP_BASE_URL",
  "PROFILE_UPLOAD_DIR",
  "ACTIVITY_UPLOAD_DIR",
  "GROUP_UPLOAD_DIR",
  "STORE_UPLOAD_DIR",
  "MEDIA_STORAGE_BACKEND",
  "MEDIA_S3_BUCKET",
  "MEDIA_S3_REGION",
  "MEDIA_S3_ENDPOINT",
  "MEDIA_S3_ACCESS_KEY_ID",
  "MEDIA_S3_SECRET_ACCESS_KEY",
  "MEDIA_S3_KEY_PREFIX",
  "MEDIA_S3_REQUEST_TIMEOUT_MS",
  "MEDIA_S3_MAX_RETRIES",
  "MEDIA_S3_FORCE_PATH_STYLE",
  "KYC_PROVIDER_ENABLED",
  "KYC_PROVIDER",
  "KYC_SESSION_TTL_SECONDS",
  "KYC_WEBHOOK_BODY_LIMIT_BYTES",
  "KYC_MOCK_WEBHOOK_HMAC_SECRET",
  "VERIFF_API_KEY",
  "VERIFF_SHARED_SECRET",
  "VERIFF_API_BASE_URL",
  "VERIFF_LIVE_CALLS_ENABLED",
  "KYC_IDENTITY_AUTHORITY",
  "KYC_MANUAL_REVIEW_ENABLED",
  "KYC_MANUAL_EVIDENCE_RETENTION_DAYS",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_KYC_EVIDENCE_FOLDER",
  "CLOUDINARY_REQUEST_TIMEOUT_MS",
  "CONSENT_ENFORCEMENT",
  "SOCIAL_RATE_LIMIT_FOLLOW_PER_USER",
  "SOCIAL_RATE_LIMIT_WAVE_PER_USER",
  "SOCIAL_RATE_LIMIT_REQUEST_PER_USER",
  "SOCIAL_RATE_LIMIT_MESSAGE_PER_USER",
  "GROUP_RATE_LIMIT_CREATE_PER_USER",
  "GROUP_RATE_LIMIT_JOIN_PER_USER",
  "GROUP_RATE_LIMIT_POST_PER_USER",
  "GROUP_RATE_LIMIT_MESSAGE_PER_USER",
  "GROUP_COMMUNITY_INTERACTIVE_ENABLED",
  "GROUP_RATE_LIMIT_STORY_PER_USER",
  "GROUP_RATE_LIMIT_MEDIA_PER_USER",
  "GROUP_RATE_LIMIT_REPORT_PER_USER",
  "TRANSACTIONAL_EMAIL_MODE",
  "TRANSACTIONAL_EMAIL_FROM",
  "RESEND_API_KEY",
  "RATE_LIMIT_STORE",
  "RATE_LIMIT_REDIS_URL",
  "RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS",
  "RESEND_REQUEST_TIMEOUT_MS",
  "RESEND_MAX_RETRIES",
  "PLATFORM_SUPER_ADMIN_USER_IDS",
  "PLATFORM_IDENTITY_REVIEWER_USER_IDS",
  "STORE_CATALOG_MANAGEMENT_ENABLED",
  "PLATFORM_STORE_CATALOG_MANAGER_USER_IDS",
  "SOCKET_IO_ENABLED",
  "SOCKET_IO_PATH",
  "SOCKET_IO_REDIS_ADAPTER_ENABLED",
  "SOCKET_IO_TYPING_MIN_INTERVAL_MS",
  "SOCKET_IO_TYPING_TTL_MS",
  "SOCKET_IO_ACCOUNT_RECHECK_INTERVAL_MS",
  "PUSH_ENABLED",
  "PUSH_WORKER_ENABLED",
  "PUSH_WORKER_INTERVAL_MS",
  "PUSH_WORKER_BATCH_SIZE",
  "PUSH_MAX_ATTEMPTS",
  "PUSH_RETRY_BASE_MS",
  "PUSH_OUTBOX_LOCK_TTL_MS",
  "PUSH_MAX_NOTIFICATION_AGE_SECONDS",
  "FIREBASE_CREDENTIALS_FILE",
  "FIREBASE_PROJECT_ID",
] as const;

export type TransactionalEmailConfig = {
  mode: TransactionalEmailMode;
  /** True when the server may hand messages to a transport (dev stub or approved provider). */
  canHandOff: boolean;
  fromAddress?: string;
  providerCredentialsPresent: boolean;
};

export type AuthEnv = {
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_TTL_SECONDS: number;
  REFRESH_TOKEN_TTL_SECONDS: number;
  AUTH_CHALLENGE_TTL_SECONDS: number;
  AUTH_RATE_LIMIT_LOGIN_PER_IP: number;
  AUTH_RATE_LIMIT_LOGIN_PER_EMAIL: number;
  AUTH_RATE_LIMIT_REGISTER_PER_IP: number;
  AUTH_RATE_LIMIT_PASSWORD_RESET_PER_IP: number;
  AUTH_RATE_LIMIT_PASSWORD_RESET_PER_EMAIL: number;
  AUTH_RATE_LIMIT_EMAIL_VERIFY_PER_USER: number;
  AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_IP: number;
  AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_USER: number;
  AUTH_RATE_LIMIT_EMAIL_CHANGE_PER_IP: number;
  AUTH_RATE_LIMIT_EMAIL_CHANGE_PER_USER: number;
  PUBLIC_APP_BASE_URL?: string;
};

export type AppEnv = z.infer<typeof envSchema> & {
  corsOriginsList: string[];
  isProduction: boolean;
  auth: AuthEnv;
  transactionalEmail: TransactionalEmailConfig;
};

const TEST_JWT_SECRET = "test-jwt-access-secret-min-32-chars!!";

function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function buildEnvInput(raw: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const input: Record<string, string | undefined> = {};
  for (const key of KNOWN_ENV_KEYS) {
    const value = raw[key];
    if (value !== undefined) {
      input[key] = value;
    }
  }
  return input;
}

function resolveJwtSecret(nodeEnv: string, configured?: string): string {
  if (configured) {
    return configured;
  }
  if (nodeEnv === "test") {
    return TEST_JWT_SECRET;
  }
  throw new Error("JWT_ACCESS_SECRET is required when NODE_ENV is not test (min 32 characters)");
}

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  if (raw !== process.env) {
    for (const key of Object.keys(raw)) {
      if (!(KNOWN_ENV_KEYS as readonly string[]).includes(key)) {
        throw new Error(`Invalid environment configuration: unrecognized key ${key}`);
      }
    }
  }

  const parsed = envSchema.safeParse(buildEnvInput(raw));
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const base = parsed.data;
  const nodeEnv = base.NODE_ENV;

  if (nodeEnv !== "test" && !base.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required when NODE_ENV is not test (set it in .env or the process environment)",
    );
  }

  const jwtSecret = resolveJwtSecret(nodeEnv, base.JWT_ACCESS_SECRET);
  const isProduction = nodeEnv === "production";

  const providerCredentialsPresent =
    base.TRANSACTIONAL_EMAIL_MODE === "provider" &&
    Boolean(base.RESEND_API_KEY?.trim()) &&
    Boolean(base.TRANSACTIONAL_EMAIL_FROM?.trim());

  const transactionalEmail: TransactionalEmailConfig = {
    mode: base.TRANSACTIONAL_EMAIL_MODE,
    canHandOff:
      base.TRANSACTIONAL_EMAIL_MODE === "dev_stub" ||
      (base.TRANSACTIONAL_EMAIL_MODE === "provider" &&
        providerCredentialsPresent &&
        Boolean(base.PUBLIC_APP_BASE_URL?.trim())),
    fromAddress: base.TRANSACTIONAL_EMAIL_FROM,
    providerCredentialsPresent,
  };

  const appEnv: AppEnv = {
    ...base,
    corsOriginsList: parseCorsOrigins(base.CORS_ORIGINS),
    isProduction,
    transactionalEmail,
    auth: {
      JWT_ACCESS_SECRET: jwtSecret,
      JWT_ACCESS_TTL_SECONDS: base.JWT_ACCESS_TTL_SECONDS,
      REFRESH_TOKEN_TTL_SECONDS: base.REFRESH_TOKEN_TTL_SECONDS,
      AUTH_CHALLENGE_TTL_SECONDS: base.AUTH_CHALLENGE_TTL_SECONDS,
      AUTH_RATE_LIMIT_LOGIN_PER_IP: base.AUTH_RATE_LIMIT_LOGIN_PER_IP,
      AUTH_RATE_LIMIT_LOGIN_PER_EMAIL: base.AUTH_RATE_LIMIT_LOGIN_PER_EMAIL,
      AUTH_RATE_LIMIT_REGISTER_PER_IP: base.AUTH_RATE_LIMIT_REGISTER_PER_IP,
      AUTH_RATE_LIMIT_PASSWORD_RESET_PER_IP: base.AUTH_RATE_LIMIT_PASSWORD_RESET_PER_IP,
      AUTH_RATE_LIMIT_PASSWORD_RESET_PER_EMAIL: base.AUTH_RATE_LIMIT_PASSWORD_RESET_PER_EMAIL,
      AUTH_RATE_LIMIT_EMAIL_VERIFY_PER_USER: base.AUTH_RATE_LIMIT_EMAIL_VERIFY_PER_USER,
      AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_IP: base.AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_IP,
      AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_USER: base.AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_USER,
      AUTH_RATE_LIMIT_EMAIL_CHANGE_PER_IP: base.AUTH_RATE_LIMIT_EMAIL_CHANGE_PER_IP,
      AUTH_RATE_LIMIT_EMAIL_CHANGE_PER_USER: base.AUTH_RATE_LIMIT_EMAIL_CHANGE_PER_USER,
      PUBLIC_APP_BASE_URL: base.PUBLIC_APP_BASE_URL,
    },
  };

  assertProductionEnvironmentSafe(appEnv, jwtSecret);

  if (appEnv.MEDIA_STORAGE_BACKEND === "s3") {
    resolveS3MediaConfig(appEnv);
  }

  return appEnv;
}
