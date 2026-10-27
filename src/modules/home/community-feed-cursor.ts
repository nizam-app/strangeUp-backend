import { AppError } from "../../common/errors/app-error.js";

type CommunityFeedCursorPayload = {
  createdAt: string;
  id: string;
};

export function encodeCommunityFeedCursor(payload: CommunityFeedCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCommunityFeedCursor(cursor: string): CommunityFeedCursorPayload {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as CommunityFeedCursorPayload;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid cursor", 400);
  }
}
