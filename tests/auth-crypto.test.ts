import { describe, expect, it } from "vitest";
import {
  SCRYPT_PARAMS_LEGACY,
  SCRYPT_PARAMS_PREFERRED,
  hashPassword,
  hashPasswordWithParams,
  normalizeEmail,
  passwordHashNeedsUpgrade,
  verifyPassword,
} from "../src/modules/auth/crypto.js";

describe("auth crypto", () => {
  it("normalizes email", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  it("hashes and verifies password with preferred parameters", async () => {
    const hash = await hashPassword("Str0ngPass1");
    expect(hash).not.toContain("Str0ngPass1");
    expect(hash).toContain(`$${SCRYPT_PARAMS_PREFERRED.p}$`);
    await expect(verifyPassword("Str0ngPass1", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
    expect(passwordHashNeedsUpgrade(hash)).toBe(false);
  });

  it("verifies legacy p=1 hashes and flags them for upgrade", async () => {
    const legacyHash = await hashPasswordWithParams("Str0ngPass1", SCRYPT_PARAMS_LEGACY);
    expect(legacyHash).toContain("$1$");
    await expect(verifyPassword("Str0ngPass1", legacyHash)).resolves.toBe(true);
    expect(passwordHashNeedsUpgrade(legacyHash)).toBe(true);
  });

  it("rejects malformed stored hashes", async () => {
    await expect(verifyPassword("Str0ngPass1", "not-a-valid-hash")).resolves.toBe(false);
    expect(passwordHashNeedsUpgrade("not-a-valid-hash")).toBe(true);
  });
});
