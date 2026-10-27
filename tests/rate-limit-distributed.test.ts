import { afterEach, describe, expect, it } from "vitest";
import { createInMemoryRateLimitStore } from "../src/infrastructure/rate-limit/in-memory-store.js";
import { createUnavailableRateLimitStore } from "../src/infrastructure/rate-limit/unavailable-store.js";
import {
  checkRateLimit,
  clearRateLimits,
  configureRateLimitStore,
  throwIfRateLimited,
} from "../src/modules/auth/rate-limit.js";
import { AppError } from "../src/common/errors/app-error.js";

describe("rate limit store adapter (Task 019)", () => {
  afterEach(() => {
    clearRateLimits();
  });

  it("shares counts across simulated app instances via one store", async () => {
    const shared = createInMemoryRateLimitStore();
    configureRateLimitStore(shared);

    expect((await checkRateLimit("login:ip:203.0.113.1", 2, 60_000, 1_000)).allowed).toBe(true);
    configureRateLimitStore(shared);
    expect((await checkRateLimit("login:ip:203.0.113.1", 2, 60_000, 1_001)).allowed).toBe(true);
    configureRateLimitStore(shared);
    const blocked = await checkRateLimit("login:ip:203.0.113.1", 2, 60_000, 1_002);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.reason).toBe("limit_exceeded");
    }
  });

  it("returns HTTP-ready 429 via throwIfRateLimited when limit exceeded", async () => {
    configureRateLimitStore(createInMemoryRateLimitStore());
    const now = 2_000_000;
    await checkRateLimit("email-change:user:u1", 1, 60_000, now);
    const result = await checkRateLimit("email-change:user:u1", 1, 60_000, now + 1);
    try {
      throwIfRateLimited(result);
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(429);
      expect((err as AppError).code).toBe("AUTH_RATE_LIMITED");
    }
  });

  it("fail-closes with 503 when shared store is unavailable", async () => {
    configureRateLimitStore(createUnavailableRateLimitStore());
    const result = await checkRateLimit("register:ip:198.51.100.9", 10, 60_000);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe("store_unavailable");
    }
    try {
      throwIfRateLimited(result);
    } catch (err) {
      expect((err as AppError).statusCode).toBe(503);
      expect((err as AppError).code).toBe("SERVICE_UNAVAILABLE");
    }
  });

  it("resets window after elapsed time", async () => {
    configureRateLimitStore(createInMemoryRateLimitStore());
    const now = 9_000_000;
    expect((await checkRateLimit("reset-key", 1, 1000, now)).allowed).toBe(true);
    expect((await checkRateLimit("reset-key", 1, 1000, now + 1)).allowed).toBe(false);
    expect((await checkRateLimit("reset-key", 1, 1000, now + 1001)).allowed).toBe(true);
  });
});
