import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]);

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
    PUBLIC_APP_BASE_URL: z.string().url().optional(),
    PROFILE_UPLOAD_DIR: z.string().min(1).default(".data/profile-media"),
    ACTIVITY_UPLOAD_DIR: z.string().min(1).default(".data/activity-media"),
    GROUP_UPLOAD_DIR: z.string().min(1).default(".data/group-media"),
    KYC_PROVIDER_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    SOCIAL_RATE_LIMIT_FOLLOW_PER_USER: z.coerce.number().int().min(1).max(1000).default(20),
    SOCIAL_RATE_LIMIT_WAVE_PER_USER: z.coerce.number().int().min(1).max(1000).default(10),
    SOCIAL_RATE_LIMIT_REQUEST_PER_USER: z.coerce.number().int().min(1).max(1000).default(10),
    SOCIAL_RATE_LIMIT_MESSAGE_PER_USER: z.coerce.number().int().min(1).max(1000).default(40),
    GROUP_RATE_LIMIT_CREATE_PER_USER: z.coerce.number().int().min(1).max(1000).default(10),
    GROUP_RATE_LIMIT_JOIN_PER_USER: z.coerce.number().int().min(1).max(1000).default(20),
    GROUP_RATE_LIMIT_POST_PER_USER: z.coerce.number().int().min(1).max(1000).default(40),
    GROUP_RATE_LIMIT_MESSAGE_PER_USER: z.coerce.number().int().min(1).max(1000).default(40),
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
  "PUBLIC_APP_BASE_URL",
  "PROFILE_UPLOAD_DIR",
  "ACTIVITY_UPLOAD_DIR",
  "GROUP_UPLOAD_DIR",
  "KYC_PROVIDER_ENABLED",
  "SOCIAL_RATE_LIMIT_FOLLOW_PER_USER",
  "SOCIAL_RATE_LIMIT_WAVE_PER_USER",
  "SOCIAL_RATE_LIMIT_REQUEST_PER_USER",
  "SOCIAL_RATE_LIMIT_MESSAGE_PER_USER",
  "GROUP_RATE_LIMIT_CREATE_PER_USER",
  "GROUP_RATE_LIMIT_JOIN_PER_USER",
  "GROUP_RATE_LIMIT_POST_PER_USER",
  "GROUP_RATE_LIMIT_MESSAGE_PER_USER",
] as const;

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
  PUBLIC_APP_BASE_URL?: string;
};

export type AppEnv = z.infer<typeof envSchema> & {
  corsOriginsList: string[];
  isProduction: boolean;
  auth: AuthEnv;
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

  return {
    ...base,
    corsOriginsList: parseCorsOrigins(base.CORS_ORIGINS),
    isProduction: nodeEnv === "production",
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
      PUBLIC_APP_BASE_URL: base.PUBLIC_APP_BASE_URL,
    },
  };
}
