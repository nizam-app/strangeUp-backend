import { AppError } from "../../common/errors/app-error.js";

export function encodeNotesCursor(value: { createdAt: Date; noteId: string }): string {
  return Buffer.from(
    JSON.stringify({ c: value.createdAt.toISOString(), i: value.noteId }),
    "utf8",
  ).toString("base64url");
}

export function decodeNotesCursor(
  raw: string | undefined,
): { createdAt: Date; noteId: string } | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      c?: string;
      i?: string;
    };
    if (!parsed.c || !parsed.i) {
      throw new AppError("VALIDATION_ERROR", "Invalid pagination cursor", 400);
    }
    return { createdAt: new Date(parsed.c), noteId: parsed.i };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError("VALIDATION_ERROR", "Invalid pagination cursor", 400);
  }
}
