import { AppError } from "../../common/errors/app-error.js";

export type SavedActivityCursor = {
  createdAt: string;
  activityId: string;
};

export function encodeSavedActivityCursor(cursor: SavedActivityCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeSavedActivityCursor(raw: string): SavedActivityCursor {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as SavedActivityCursor;
    if (!parsed?.createdAt || !parsed?.activityId) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }
}
