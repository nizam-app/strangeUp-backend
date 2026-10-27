import { describe, expect, it } from "vitest";
import {
  emailChangeConfirmSchema,
  emailChangeRequestSchema,
  sessionIdParamSchema,
} from "../src/modules/settings/settings.validation.js";

describe("emailChangeRequestSchema", () => {
  it("requires email and password", () => {
    const parsed = emailChangeRequestSchema.parse({
      newEmail: "new@example.com",
      currentPassword: "ValidPass1",
    });
    expect(parsed.newEmail).toBe("new@example.com");
  });

  it("rejects extra fields", () => {
    expect(() =>
      emailChangeRequestSchema.parse({
        newEmail: "a@b.com",
        currentPassword: "x",
        extra: true,
      }),
    ).toThrow();
  });
});

describe("emailChangeConfirmSchema", () => {
  it("requires token", () => {
    expect(emailChangeConfirmSchema.parse({ token: "abc" }).token).toBe("abc");
  });
});

describe("sessionIdParamSchema", () => {
  it("requires uuid", () => {
    expect(() => sessionIdParamSchema.parse({ sessionId: "bad" })).toThrow();
  });
});
