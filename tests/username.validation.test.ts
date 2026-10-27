import { describe, expect, it } from "vitest";
import { isValidUsername, normalizeUsername } from "../src/modules/me/username.js";

describe("username rules", () => {
  it("accepts valid handles", () => {
    expect(isValidUsername("alexmilo")).toBe(true);
    expect(isValidUsername("a_b_2")).toBe(true);
    expect(isValidUsername("abc")).toBe(true);
  });

  it("rejects invalid length and characters", () => {
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("a".repeat(31))).toBe(false);
    expect(isValidUsername("AlexMilo")).toBe(false);
    expect(isValidUsername("user-name")).toBe(false);
  });

  it("normalizes with trim and lowercase", () => {
    expect(normalizeUsername("  alex  ")).toBe("alex");
  });
});
