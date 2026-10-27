import type { AppEnv } from "../../config/env.js";
import { createInMemoryRateLimitStore } from "./in-memory-store.js";
import { createRedisRateLimitStore } from "./redis-store.js";
import { createUnavailableRateLimitStore } from "./unavailable-store.js";
import type { RateLimitStore } from "./types.js";
import type { Logger } from "pino";

export async function resolveRateLimitStore(env: AppEnv, logger?: Logger): Promise<RateLimitStore> {
  if (env.RATE_LIMIT_STORE === "redis") {
    const url = env.RATE_LIMIT_REDIS_URL?.trim();
    if (!url) {
      throw new Error("RATE_LIMIT_REDIS_URL is required when RATE_LIMIT_STORE=redis");
    }
    return createRedisRateLimitStore({
      redisUrl: url,
      commandTimeoutMs: env.RATE_LIMIT_REDIS_COMMAND_TIMEOUT_MS,
      logger,
    });
  }

  if (!env.isProduction) {
    return createInMemoryRateLimitStore();
  }

  if (env.RATE_LIMIT_STORE === "fail_closed") {
    return createUnavailableRateLimitStore();
  }

  return createUnavailableRateLimitStore();
}
