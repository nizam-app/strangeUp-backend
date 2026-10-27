import { AppError } from "../../common/errors/app-error.js";

type NotificationCursorPayload = {
  createdAt: string;
  id: string;
};

export function encodeNotificationCursor(payload: NotificationCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeNotificationCursor(cursor: string): NotificationCursorPayload {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as NotificationCursorPayload;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid cursor", 400);
  }
}
