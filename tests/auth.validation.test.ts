import { describe, expect, it } from "vitest";
import { passwordChangeBodySchema } from "../src/modules/auth/auth.validation.js";

describe("passwordChangeBodySchema", () => {
  it("accepts valid current and new passwords", () => {
    const parsed = passwordChangeBodySchema.parse({
      currentPassword: "OldValid1",
      newPassword: "NewValid2",
    });
    expect(parsed.newPassword).toBe("NewValid2");
  });

  it("rejects weak new password", () => {
    expect(() =>
      passwordChangeBodySchema.parse({
        currentPassword: "OldValid1",
        newPassword: "short",
      }),
    ).toThrow();
  });

  it("rejects when new password equals current password", () => {
    expect(() =>
      passwordChangeBodySchema.parse({
        currentPassword: "SameValid1",
        newPassword: "SameValid1",
      }),
    ).toThrow(/differ from current/);
  });

  it("rejects unknown keys (strict)", () => {
    expect(() =>
      passwordChangeBodySchema.parse({
        currentPassword: "OldValid1",
        newPassword: "NewValid2",
        email: "x@example.com",
      }),
    ).toThrow();
  });
});
