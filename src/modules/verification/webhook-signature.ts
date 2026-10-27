import { createHmac, timingSafeEqual } from "node:crypto";

/** Veriff-style HMAC-SHA256 hex digest over the raw HTTP body. */
export function computeHmacSha256Hex(secret: string, rawBody: Buffer): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyHmacSha256Hex(
  secret: string,
  rawBody: Buffer,
  providedSignature: string | undefined,
): boolean {
  if (!providedSignature?.trim()) {
    return false;
  }
  const expected = computeHmacSha256Hex(secret, rawBody);
  const provided = providedSignature.trim().toLowerCase();
  if (provided.length !== expected.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}
