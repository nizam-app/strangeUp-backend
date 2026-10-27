import { afterEach, describe, expect, it } from "vitest";
import {
  RATE_LIMITER_IS_IN_MEMORY_ONLY,
  checkRateLimit,
  clearRateLimits,
} from "../src/modules/auth/rate-limit.js";

describe("in-memory rate limiter (Task 018)", () => {
  afterEach(() => {
    clearRateLimits();
  });

  it("documents single-process scope for production planning", () => {
    expect(RATE_LIMITER_IS_IN_MEMORY_ONLY).toBe(true);
  });

  it("allows requests under the limit within the window", async () => {
    const now = 1_000_000;
    expect((await checkRateLimit("k", 2, 60_000, now)).allowed).toBe(true);
    expect((await checkRateLimit("k", 2, 60_000, now + 1)).allowed).toBe(true);
    const blocked = await checkRateLimit("k", 2, 60_000, now + 2);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed && blocked.reason === "limit_exceeded") {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("resets the bucket after the window elapses", async () => {
    const now = 5_000_000;
    expect((await checkRateLimit("reset-key", 1, 1000, now)).allowed).toBe(true);
    expect((await checkRateLimit("reset-key", 1, 1000, now + 1)).allowed).toBe(false);
    expect((await checkRateLimit("reset-key", 1, 1000, now + 1001)).allowed).toBe(true);
  });
});
