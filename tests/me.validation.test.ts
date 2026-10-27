import { describe, expect, it } from "vitest";
import { profilePatchSchema } from "../src/modules/me/me.validation.js";

describe("profilePatchSchema", () => {
  it("accepts each allowlisted field", () => {
    expect(profilePatchSchema.parse({ firstName: "Alex" }).firstName).toBe("Alex");
    expect(profilePatchSchema.parse({ lastName: "Milo" }).lastName).toBe("Milo");
    expect(profilePatchSchema.parse({ displayName: "Alex M." }).displayName).toBe("Alex M.");
    expect(profilePatchSchema.parse({ username: "alex_m" }).username).toBe("alex_m");
    expect(profilePatchSchema.parse({ bio: "Hello" }).bio).toBe("Hello");
    expect(
      profilePatchSchema.parse({ scheduleTimeZone: "America/New_York" }).scheduleTimeZone,
    ).toBe("America/New_York");
    expect(profilePatchSchema.parse({ profileVisibility: "EVERYONE" }).profileVisibility).toBe(
      "EVERYONE",
    );
    expect(profilePatchSchema.parse({ locationCity: "Miami" }).locationCity).toBe("Miami");
    expect(profilePatchSchema.parse({ locationCity: null }).locationCity).toBeNull();
  });

  it("rejects unknown keys (strict)", () => {
    expect(() => profilePatchSchema.parse({ bio: "x", birthDate: "1996-10-14" })).toThrow();
    expect(() => profilePatchSchema.parse({ role: "admin" })).toThrow();
  });

  it("accepts valid username and rejects invalid username", () => {
    expect(profilePatchSchema.parse({ username: "alexmilo" }).username).toBe("alexmilo");
    expect(profilePatchSchema.parse({ username: null }).username).toBeNull();
    expect(() => profilePatchSchema.parse({ username: "Alex" })).toThrow();
    expect(() => profilePatchSchema.parse({ username: "ab" })).toThrow();
    expect(() => profilePatchSchema.parse({ username: "a".repeat(31) })).toThrow();
  });

  it("rejects empty body", () => {
    expect(() => profilePatchSchema.parse({})).toThrow(/At least one profile field/);
  });

  it("enforces bio max length 300 (D-BIO-MAX)", () => {
    const ok = "a".repeat(300);
    expect(profilePatchSchema.parse({ bio: ok }).bio).toHaveLength(300);
    expect(() => profilePatchSchema.parse({ bio: "a".repeat(301) })).toThrow();
  });

  it("rejects invalid IANA time zone", () => {
    expect(() => profilePatchSchema.parse({ scheduleTimeZone: "Not/A_Zone" })).toThrow();
  });
});
