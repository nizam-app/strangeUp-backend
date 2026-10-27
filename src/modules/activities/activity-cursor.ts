import { AppError } from "../../common/errors/app-error.js";

export type ActivityStartsCursor = {
  startsAt: string;
  id: string;
};

export type ActivityCreatedCursor = {
  createdAt: string;
  id: string;
};

export function encodeActivityStartsCursor(cursor: ActivityStartsCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeActivityStartsCursor(raw: string): ActivityStartsCursor {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as ActivityStartsCursor;
    if (!parsed?.startsAt || !parsed?.id) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }
}

export function encodeActivityCreatedCursor(cursor: ActivityCreatedCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeActivityCreatedCursor(raw: string): ActivityCreatedCursor {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as ActivityCreatedCursor;
    if (!parsed?.createdAt || !parsed?.id) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }
}
