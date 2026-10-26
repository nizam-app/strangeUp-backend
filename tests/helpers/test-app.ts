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
    corsOriginsList: ["http://localhost:3000"],
    isProduction: false,
    ...overrides,
  };
}

export function createTestApp(options?: { env?: Partial<AppEnv>; db?: DatabaseClient | null }) {
  const env = buildTestEnv(options?.env);
  const logger = pino({ level: "silent" });
  const db = options?.db !== undefined ? options.db : null;
  return createApp({ env, logger, db });
}
