import { AppError } from "../../common/errors/app-error.js";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export function normalizeStorageKeySegment(raw: string): string {
  const normalized = raw
    .replace(/\\/g, "/")
    .replace(/^(\.\.(\/|$))+/, "")
    .replace(/^\/+/, "");
  if (normalized.includes("..")) {
    throw new AppError("INTERNAL_ERROR", "Invalid storage key", 500);
  }
  return normalized;
}

export function assertStorageKeySegments(
  storageKey: string,
  expectedFirstSegment: string,
  minSegments: number,
): string[] {
  const normalized = normalizeStorageKeySegment(storageKey);
  if (normalized.includes("..") || normalized.includes("\0")) {
    throw new AppError("INTERNAL_ERROR", "Invalid storage key", 500);
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length < minSegments) {
    throw new AppError("INTERNAL_ERROR", "Invalid storage key", 500);
  }
  if (segments[0] !== expectedFirstSegment) {
    throw new AppError("INTERNAL_ERROR", "Storage key mismatch", 500);
  }
  return segments;
}

export function assertUuidSegment(value: string, message = "Invalid storage key"): void {
  if (!UUID_RE.test(value)) {
    throw new AppError("INTERNAL_ERROR", message, 500);
  }
}

export function buildS3ObjectKey(
  namespace: string,
  keyPrefix: string | undefined,
  storageKey: string,
): string {
  const normalized = normalizeStorageKeySegment(storageKey);
  if (!normalized || normalized.includes("..") || normalized.includes("\0")) {
    throw new AppError("INTERNAL_ERROR", "Invalid storage key", 500);
  }
  const prefix = keyPrefix?.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const ns = namespace.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!ns) {
    throw new AppError("INTERNAL_ERROR", "Invalid storage key", 500);
  }
  return prefix ? `${prefix}/${ns}/${normalized}` : `${ns}/${normalized}`;
}
