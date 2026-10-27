import type { RateLimitResult, RateLimitStore } from "./types.js";

type Bucket = { count: number; resetAt: number };

export function createInMemoryRateLimitStore(
  buckets: Map<string, Bucket> = new Map(),
): RateLimitStore {
  return {
    check(
      key: string,
      limit: number,
      windowMs: number,
      now = Date.now(),
    ): Promise<RateLimitResult> {
      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return Promise.resolve({ allowed: true });
      }
      if (existing.count >= limit) {
        return Promise.resolve({
          allowed: false,
          reason: "limit_exceeded",
          retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
        });
      }
      existing.count += 1;
      return Promise.resolve({ allowed: true });
    },
    clear(): void {
      buckets.clear();
    },
  };
}
