export type MediaStorageErrorCode =
  "NOT_FOUND" | "ACCESS_DENIED" | "VALIDATION" | "TIMEOUT" | "UNAVAILABLE" | "INTERNAL";

export class MediaStorageError extends Error {
  readonly code: MediaStorageErrorCode;
  readonly retryable: boolean;

  constructor(code: MediaStorageErrorCode, message: string, options?: { retryable?: boolean }) {
    super(message);
    this.name = "MediaStorageError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
  }
}

export function isMediaStorageNotFound(err: unknown): boolean {
  return err instanceof MediaStorageError && err.code === "NOT_FOUND";
}
