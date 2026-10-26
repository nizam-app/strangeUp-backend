export type AppErrorCode =
  "VALIDATION_ERROR" | "NOT_FOUND" | "INTERNAL_ERROR" | "SERVICE_UNAVAILABLE";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: number;
  readonly exposeMessage: boolean;

  constructor(
    code: AppErrorCode,
    message: string,
    statusCode: number,
    options?: { exposeMessage?: boolean; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.exposeMessage = options?.exposeMessage ?? true;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
