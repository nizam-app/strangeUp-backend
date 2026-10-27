import pino from "pino";
import type { AppEnv } from "../../src/config/env.js";
import { createApp } from "../../src/app.js";
import type { DatabaseClient } from "../../src/infrastructure/database/prisma.js";

export function buildTestEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    NODE_ENV: "test",
    PORT: 0,
    DATABASE_URL: undefined,
    CORS_ORIGINS: "http://localhost:3000",
    LOG_LEVEL: "silent",
    JSON_BODY_LIMIT: "100kb",
    TRUST_PROXY: false,
    JWT_ACCESS_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_SECONDS: 60 * 60 * 24 * 30,
    AUTH_CHALLENGE_TTL_SECONDS: 60 * 60 * 24,
    AUTH_RATE_LIMIT_LOGIN_PER_IP: 10,
    AUTH_RATE_LIMIT_LOGIN_PER_EMAIL: 5,
    AUTH_RATE_LIMIT_REGISTER_PER_IP: 10,
    AUTH_RATE_LIMIT_PASSWORD_RESET_PER_IP: 10,
    AUTH_RATE_LIMIT_PASSWORD_RESET_PER_EMAIL: 5,
    AUTH_RATE_LIMIT_EMAIL_VERIFY_PER_USER: 5,
    AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_IP: 10,
    AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_USER: 5,
    PROFILE_UPLOAD_DIR: ".data/profile-media",
    ACTIVITY_UPLOAD_DIR: ".data/activity-media",
    GROUP_UPLOAD_DIR: ".data/group-media",
    KYC_PROVIDER_ENABLED: false,
    SOCIAL_RATE_LIMIT_FOLLOW_PER_USER: 20,
    SOCIAL_RATE_LIMIT_WAVE_PER_USER: 10,
    SOCIAL_RATE_LIMIT_REQUEST_PER_USER: 10,
    SOCIAL_RATE_LIMIT_MESSAGE_PER_USER: 40,
    GROUP_RATE_LIMIT_CREATE_PER_USER: 10,
    GROUP_RATE_LIMIT_JOIN_PER_USER: 20,
    GROUP_RATE_LIMIT_POST_PER_USER: 40,
    GROUP_RATE_LIMIT_MESSAGE_PER_USER: 40,
    corsOriginsList: ["http://localhost:3000"],
    isProduction: false,
    auth: {
      JWT_ACCESS_SECRET: "test-jwt-access-secret-min-32-chars!!",
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TOKEN_TTL_SECONDS: 60 * 60 * 24 * 30,
      AUTH_CHALLENGE_TTL_SECONDS: 60 * 60 * 24,
      AUTH_RATE_LIMIT_LOGIN_PER_IP: 10,
      AUTH_RATE_LIMIT_LOGIN_PER_EMAIL: 5,
      AUTH_RATE_LIMIT_REGISTER_PER_IP: 10,
      AUTH_RATE_LIMIT_PASSWORD_RESET_PER_IP: 10,
      AUTH_RATE_LIMIT_PASSWORD_RESET_PER_EMAIL: 5,
      AUTH_RATE_LIMIT_EMAIL_VERIFY_PER_USER: 5,
      AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_IP: 10,
      AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_USER: 5,
    },
    ...overrides,
  };
}

export function createTestApp(options?: { env?: Partial<AppEnv>; db?: DatabaseClient | null }) {
  const env = buildTestEnv(options?.env);
  const logger = pino({ level: "silent" });
  const db = options?.db !== undefined ? options.db : null;
  return createApp({ env, logger, db });
}
