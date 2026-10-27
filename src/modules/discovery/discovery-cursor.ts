import { AppError } from "../../common/errors/app-error.js";

export type DiscoverPeopleCursor = {
  createdAt: string;
  id: string;
};

export function encodeDiscoverCursor(cursor: DiscoverPeopleCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeDiscoverCursor(raw: string): DiscoverPeopleCursor {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as DiscoverPeopleCursor;
    if (!parsed?.createdAt || !parsed?.id) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }
}
