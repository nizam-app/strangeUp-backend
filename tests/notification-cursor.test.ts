import { describe, expect, it } from "vitest";
import {
  decodeNotificationCursor,
  encodeNotificationCursor,
} from "../src/modules/notifications/notification-cursor.js";

describe("notification cursor", () => {
  it("round-trips createdAt and id", () => {
    const encoded = encodeNotificationCursor({
      createdAt: "2026-10-27T12:00:00.000Z",
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(decodeNotificationCursor(encoded)).toEqual({
      createdAt: "2026-10-27T12:00:00.000Z",
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
  });
});
