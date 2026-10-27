import { AppError } from "../../common/errors/app-error.js";

export type JobListingCursor = {
  createdAt: string;
  id: string;
};

export function encodeJobListingCursor(cursor: JobListingCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeJobListingCursor(raw: string): JobListingCursor {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as JobListingCursor;
    if (!parsed?.createdAt || !parsed?.id) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }
}

export type JobApplicationCursor = {
  createdAt: string;
  id: string;
};

export function encodeJobApplicationCursor(cursor: JobApplicationCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeJobApplicationCursor(raw: string): JobApplicationCursor {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as JobApplicationCursor;
    if (!parsed?.createdAt || !parsed?.id) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
  }
}
