import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLen, options, (err, derived) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(derived);
    });
  });
}

/** Parameters used for newly generated password hashes (OWASP scrypt example: N=2^14, r=8, p=5). */
export const SCRYPT_PARAMS_PREFERRED = { N: 16384, r: 8, p: 5, keyLen: 64 };

/** Legacy default from Task 002B.1 (p=1); still verified via per-hash stored N/r/p. */
export const SCRYPT_PARAMS_LEGACY = { N: 16384, r: 8, p: 1, keyLen: 64 };

function scryptOptions(N: number, r: number, p: number) {
  return {
    N,
    r,
    p,
    maxmem: 128 * N * r * 2,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashIp(ip: string): string {
  return hashSha256(`ip:${ip}`);
}

export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function formatStoredHash(N: number, r: number, p: number, salt: Buffer, derived: Buffer): string {
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export function passwordHashNeedsUpgrade(stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return true;
  }
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return true;
  }
  return (
    N !== SCRYPT_PARAMS_PREFERRED.N ||
    r !== SCRYPT_PARAMS_PREFERRED.r ||
    p !== SCRYPT_PARAMS_PREFERRED.p
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const { N, r, p, keyLen } = SCRYPT_PARAMS_PREFERRED;
  const derived = await scryptAsync(password, salt, keyLen, {
    ...scryptOptions(N, r, p),
  });
  return formatStoredHash(N, r, p, salt, derived);
}

/** Test helper: produce a hash with legacy cost parameters without changing preferred defaults. */
export async function hashPasswordWithParams(
  password: string,
  params: { N: number; r: number; p: number; keyLen: number },
): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, params.keyLen, {
    ...scryptOptions(params.N, params.r, params.p),
  });
  return formatStoredHash(params.N, params.r, params.p, salt, derived);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }
  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");
  const derived = await scryptAsync(password, salt, expected.length, {
    ...scryptOptions(N, r, p),
  });
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}

export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
