import { describe, expect, it } from "vitest";
import {
  computeHmacSha256Hex,
  verifyHmacSha256Hex,
} from "../src/modules/verification/webhook-signature.js";

describe("verification webhook HMAC", () => {
  it("verifies valid signatures with constant-time comparison semantics", () => {
    const secret = "test-webhook-secret-min-32-characters!";
    const body = Buffer.from(JSON.stringify({ id: "evt-1" }), "utf8");
    const sig = computeHmacSha256Hex(secret, body);
    expect(verifyHmacSha256Hex(secret, body, sig)).toBe(true);
    expect(verifyHmacSha256Hex(secret, body, "deadbeef")).toBe(false);
    expect(verifyHmacSha256Hex(secret, Buffer.from("{}"), sig)).toBe(false);
  });
});
