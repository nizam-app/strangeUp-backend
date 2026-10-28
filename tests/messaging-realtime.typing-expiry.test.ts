import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearServerTypingExpiryForSocket,
  scheduleServerTypingExpiry,
} from "../src/modules/messaging-realtime/messaging-realtime.typing-expiry.js";

describe("messaging-realtime typing expiry (Task 023D)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits server-side typing stop after TTL", () => {
    vi.useFakeTimers();
    const stops: unknown[] = [];
    scheduleServerTypingExpiry({
      socketId: "sock-1",
      roomKey: "dm:abc",
      ttlMs: 5000,
      stopContext: { target: "dm", id: "abc", userId: "user-1" },
      emitStop: (ctx) => {
        stops.push(ctx);
      },
    });
    vi.advanceTimersByTime(4999);
    expect(stops).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(stops).toHaveLength(1);
    clearServerTypingExpiryForSocket("sock-1");
  });
});
