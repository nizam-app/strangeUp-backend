import { AppError } from "../../common/errors/app-error.js";

export type GroupCreatedCursor = {
  createdAt: string;
  id: string;
};

export type GroupPinnedCursor = {
  pinned: number;
  createdAt: string;
  id: string;
};

export function encodeGroupCreatedCursor(cursor: GroupCreatedCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeGroupCreatedCursor(raw: string): GroupCreatedCursor {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as GroupCreatedCursor;
    if (!parsed?.createdAt || !parsed?.id) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }
}

export function encodeGroupPinnedCursor(cursor: GroupPinnedCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeGroupPinnedCursor(raw: string): GroupPinnedCursor {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as GroupPinnedCursor;
    if (parsed?.pinned !== 0 && parsed?.pinned !== 1) {
      throw new Error("invalid");
    }
    if (!parsed?.createdAt || !parsed?.id) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }
}
