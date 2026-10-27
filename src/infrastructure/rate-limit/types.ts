export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "limit_exceeded"; retryAfterSeconds: number }
  | { allowed: false; reason: "store_unavailable" };

export interface RateLimitStore {
  /** Fixed-window counter; implementations must not weaken limits vs prior in-memory behavior. */
  check(key: string, limit: number, windowMs: number, now?: number): Promise<RateLimitResult>;
  clear(): void;
  disconnect?(): Promise<void>;
}
