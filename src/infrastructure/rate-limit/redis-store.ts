import { Redis } from "ioredis";
import type { Logger } from "pino";
import { FIXED_WINDOW_RATE_LIMIT_LUA } from "./fixed-window-lua.js";
import type { RateLimitResult, RateLimitStore } from "./types.js";

export type RedisRateLimitStoreOptions = {
  redisUrl: string;
  keyPrefix?: string;
  commandTimeoutMs?: number;
  logger?: Logger;
};

function maskRedisUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "[REDACTED]";
    }
    return parsed.toString();
  } catch {
    return "[invalid-redis-url]";
  }
}

export async function createRedisRateLimitStore(
  options: RedisRateLimitStoreOptions,
): Promise<RateLimitStore & { disconnect(): Promise<void> }> {
  const prefix = options.keyPrefix ?? "strangeup:rl:";
  const commandTimeoutMs = options.commandTimeoutMs ?? 2_000;
  const useTls = options.redisUrl.startsWith("rediss://");

  const redis = new Redis(options.redisUrl, {
    tls: useTls ? {} : undefined,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    await redis.ping();
  } catch (err: unknown) {
    await redis.quit().catch(() => undefined);
    const message = err instanceof Error ? err.message : "unknown error";
    throw new Error(
      `Rate limit Redis readiness check failed for ${maskRedisUrl(options.redisUrl)}: ${message}`,
      { cause: err },
    );
  }

  options.logger?.info(
    { redis: maskRedisUrl(options.redisUrl), protocol: useTls ? "rediss" : "redis" },
    "rate limit Redis store connected",
  );

  const evalWithTimeout = async (
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> => {
    const namespacedKey = `${prefix}${key}`;
    try {
      const evalPromise: Promise<[number, number]> = redis.eval(
        FIXED_WINDOW_RATE_LIMIT_LUA,
        1,
        namespacedKey,
        String(limit),
        String(windowMs),
      ) as Promise<[number, number]>;

      const result = await Promise.race([
        evalPromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("rate limit redis command timeout"));
          }, commandTimeoutMs).unref();
        }),
      ]);

      const allowedFlag = result[0];
      if (allowedFlag === 1) {
        return { allowed: true };
      }
      const ttlMs = Math.max(result[1], 0);
      return {
        allowed: false,
        reason: "limit_exceeded",
        retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
      };
    } catch (err) {
      options.logger?.warn(
        { err: err instanceof Error ? err.message : "unknown" },
        "rate limit Redis command failed (fail closed)",
      );
      return { allowed: false, reason: "store_unavailable" };
    }
  };

  return {
    check(key: string, limit: number, windowMs: number, _now?: number): Promise<RateLimitResult> {
      return evalWithTimeout(key, limit, windowMs);
    },
    clear(): void {
      /* production store — tests use isolated DB or mock */
    },
    async disconnect(): Promise<void> {
      await redis.quit();
    },
  };
}
