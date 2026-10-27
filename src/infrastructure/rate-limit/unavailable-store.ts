import type { RateLimitResult, RateLimitStore } from "./types.js";

/** Fail closed when a shared store is required but not configured or reachable. */
export function createUnavailableRateLimitStore(): RateLimitStore {
  return {
    check(): Promise<RateLimitResult> {
      return Promise.resolve({ allowed: false, reason: "store_unavailable" });
    },
    clear(): void {
      /* no-op */
    },
  };
}
