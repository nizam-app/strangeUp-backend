import { describe, expect, it } from "vitest";
import { shouldEmitTypingStart } from "../src/modules/messaging-realtime/messaging-realtime.typing.js";

describe("messaging-realtime typing throttle", () => {
  it("throttles rapid typing:start for the same user and room", () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const room = "dm:22222222-2222-4222-8222-222222222222";
    expect(shouldEmitTypingStart(userId, room, 2_000)).toBe(true);
    expect(shouldEmitTypingStart(userId, room, 2_000)).toBe(false);
  });
});
