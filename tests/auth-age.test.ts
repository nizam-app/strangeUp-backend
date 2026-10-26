import { describe, expect, it } from "vitest";
import { isAtLeast18UsaLaunch, parseBirthDateOnly } from "../src/modules/auth/age-eligibility.js";

describe("age eligibility (USA 18+)", () => {
  it("parses valid ISO date-only", () => {
    const d = parseBirthDateOnly("2000-01-15");
    expect(d).not.toBeNull();
    expect(d!.toISOString().slice(0, 10)).toBe("2000-01-15");
  });

  it("rejects invalid calendar dates", () => {
    expect(parseBirthDateOnly("2000-02-30")).toBeNull();
  });

  it("enforces 18+ as of reference date", () => {
    const birth = parseBirthDateOnly("2010-01-01")!;
    expect(isAtLeast18UsaLaunch(birth, new Date("2026-01-01"))).toBe(false);
    const adult = parseBirthDateOnly("2000-01-01")!;
    expect(isAtLeast18UsaLaunch(adult, new Date("2026-01-01"))).toBe(true);
  });

  it("allows registration on exact 18th birthday (UTC date-only)", () => {
    const birth = parseBirthDateOnly("2008-03-15")!;
    expect(isAtLeast18UsaLaunch(birth, new Date("2026-03-15T23:59:59Z"))).toBe(true);
  });

  it("rejects one day before 18th birthday", () => {
    const birth = parseBirthDateOnly("2008-03-15")!;
    expect(isAtLeast18UsaLaunch(birth, new Date("2026-03-14T12:00:00Z"))).toBe(false);
  });

  it("accepts valid leap-day birth dates", () => {
    expect(parseBirthDateOnly("2000-02-29")).not.toBeNull();
    expect(parseBirthDateOnly("2001-02-29")).toBeNull();
  });
});
