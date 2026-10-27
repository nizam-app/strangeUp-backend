import { AppError } from "../../common/errors/app-error.js";
import {
  clearRateLimitStore,
  getRateLimitStore,
} from "../../infrastructure/rate-limit/store-registry.js";
import type { RateLimitResult } from "../../infrastructure/rate-limit/types.js";

export type { RateLimitResult } from "../../infrastructure/rate-limit/types.js";

export {
  configureRateLimitStore,
  disconnectRateLimitStore,
  resetRateLimitStoreForTests,
} from "../../infrastructure/rate-limit/store-registry.js";
export { resolveRateLimitStore } from "../../infrastructure/rate-limit/resolve-store.js";
export { createInMemoryRateLimitStore } from "../../infrastructure/rate-limit/in-memory-store.js";

/** @deprecated use `env.RATE_LIMIT_STORE === "memory" && !env.isProduction` in new code */
export const RATE_LIMITER_IS_IN_MEMORY_ONLY = true as const;

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  return getRateLimitStore().check(key, limit, windowMs, now);
}

export function throwIfRateLimited(result: RateLimitResult): void {
  if (result.allowed) {
    return;
  }
  if (result.reason === "store_unavailable") {
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "Abuse protection is temporarily unavailable; try again later",
      503,
    );
  }
  throw new AppError("AUTH_RATE_LIMITED", "Too many requests", 429);
}

/** Test helper */
export function clearRateLimits(): void {
  clearRateLimitStore();
}
