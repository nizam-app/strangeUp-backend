import { describe, expect, it, vi, beforeEach } from "vitest";
import pino from "pino";

const evalMock = vi.fn();
const connectMock = vi.fn();
const pingMock = vi.fn();
const quitMock = vi.fn();

vi.mock("ioredis", () => ({
  Redis: class MockRedis {
    connect = connectMock;
    ping = pingMock;
    eval = evalMock;
    quit = quitMock;
    constructor(_url: string, _opts: unknown) {}
  },
}));

describe("Redis rate limit store (Task 019B)", () => {
  beforeEach(() => {
    evalMock.mockReset();
    connectMock.mockReset();
    pingMock.mockReset();
    quitMock.mockReset();
    connectMock.mockResolvedValue(undefined);
    pingMock.mockResolvedValue("PONG");
    quitMock.mockResolvedValue("OK");
  });

  it("allows under limit and blocks when Lua returns deny", async () => {
    evalMock.mockResolvedValueOnce([1, 0]).mockResolvedValueOnce([0, 4500]);
    const { createRedisRateLimitStore } =
      await import("../src/infrastructure/rate-limit/redis-store.js");
    const store = await createRedisRateLimitStore({
      redisUrl: "rediss://default:secret@example.upstash.io:6379",
      logger: pino({ level: "silent" }),
      commandTimeoutMs: 5_000,
    });

    const first = await store.check("login:ip:1.2.3", 2, 60_000);
    expect(first.allowed).toBe(true);
    const second = await store.check("login:ip:1.2.3", 2, 60_000);
    expect(second.allowed).toBe(false);
    if (!second.allowed) {
      expect(second.reason).toBe("limit_exceeded");
    }
    await store.disconnect();
  });

  it("fail-closes when Redis eval errors", async () => {
    evalMock.mockRejectedValue(new Error("connection lost"));
    const { createRedisRateLimitStore } =
      await import("../src/infrastructure/rate-limit/redis-store.js");
    const store = await createRedisRateLimitStore({
      redisUrl: "rediss://default:secret@example.upstash.io:6379",
      logger: pino({ level: "silent" }),
    });
    const result = await store.check("register:ip:9.9.9.9", 5, 60_000);
    expect(result).toEqual({ allowed: false, reason: "store_unavailable" });
    await store.disconnect();
  });
});
