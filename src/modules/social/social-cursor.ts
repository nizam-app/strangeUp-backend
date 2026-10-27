import { AppError } from "../../common/errors/app-error.js";

export type SocialCreatedCursor = {
  createdAt: string;
  id: string;
};

export type SocialUpdatedCursor = {
  updatedAt: string;
  id: string;
};

export function encodeSocialCreatedCursor(cursor: SocialCreatedCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeSocialCreatedCursor(raw: string): SocialCreatedCursor {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as SocialCreatedCursor;
    if (!parsed?.createdAt || !parsed?.id) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }
}

export function encodeSocialUpdatedCursor(cursor: SocialUpdatedCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeSocialUpdatedCursor(raw: string): SocialUpdatedCursor {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as SocialUpdatedCursor;
    if (!parsed?.updatedAt || !parsed?.id) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }
}
