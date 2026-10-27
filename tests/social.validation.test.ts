import { describe, expect, it } from "vitest";
import {
  createMessageRequestBodySchema,
  sendDirectMessageBodySchema,
  socialUserIdParamSchema,
} from "../src/modules/social/social.validation.js";

describe("social validation", () => {
  it("rejects self-looking malformed ids and extra keys", () => {
    expect(() => socialUserIdParamSchema.parse({ userId: "not-a-uuid" })).toThrow();
    expect(() =>
      createMessageRequestBodySchema.parse({
        targetUserId: "11111111-1111-4111-8111-111111111111",
        body: "hi",
      }),
    ).toThrow();
  });

  it("bounds message text and ignores delivery claims", () => {
    expect(() => sendDirectMessageBodySchema.parse({ body: "" })).toThrow();
    expect(() => sendDirectMessageBodySchema.parse({ body: "x".repeat(2001) })).toThrow();
    expect(() =>
      sendDirectMessageBodySchema.parse({ body: "hello", delivered: true, encrypted: true }),
    ).toThrow();
    expect(sendDirectMessageBodySchema.parse({ body: "hello" }).body).toBe("hello");
  });
});
