import { describe, expect, it } from "vitest";
import { socialDtoContainsSensitiveKeys } from "../src/modules/social/social.dto.js";
import {
  decodeSocialCreatedCursor,
  encodeSocialCreatedCursor,
} from "../src/modules/social/social-cursor.js";

describe("social DTO and cursors", () => {
  it("flags sensitive keys that must never appear on social DTOs", () => {
    expect(socialDtoContainsSensitiveKeys({ userId: "x", displayName: "Alex" })).toBe(false);
    expect(socialDtoContainsSensitiveKeys({ userId: "x", email: "a@b.com" })).toBe(true);
    expect(socialDtoContainsSensitiveKeys({ meetingInstructions: "secret" })).toBe(true);
  });

  it("round-trips created cursors and rejects garbage", () => {
    const encoded = encodeSocialCreatedCursor({
      createdAt: "2030-01-01T00:00:00.000Z",
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(decodeSocialCreatedCursor(encoded).id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(() => decodeSocialCreatedCursor("not-base64")).toThrow();
  });
});
