import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";

describe("loadEnv", () => {
  it("allows missing DATABASE_URL in test environment", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      CORS_ORIGINS: "http://localhost:3000",
    });
    expect(env.NODE_ENV).toBe("test");
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it("rejects unknown environment keys (strict schema)", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "test",
        UNEXPECTED_KEY: "nope",
      }),
    ).toThrow(/Invalid environment configuration/);
  });

  it("requires DATABASE_URL outside test", () => {
    expect(() =>
      loadEnv({
        NODE_ENV: "development",
        CORS_ORIGINS: "http://localhost:3000",
      }),
    ).toThrow(/DATABASE_URL is required/);
  });
});
