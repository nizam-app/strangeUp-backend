import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, isAppError } from "../errors/app-error.js";
import type { ApiErrorResponse } from "../types/api.js";
import { redactSensitive } from "../utils/redact.js";
import type { Logger } from "pino";

function zodToAppError(): AppError {
  return new AppError("VALIDATION_ERROR", "Request validation failed", 400);
}

export function createErrorHandler(options: { logger: Logger; isProduction: boolean }) {
  const { logger, isProduction } = options;

  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    let appError: AppError;

    if (isAppError(err)) {
      appError = err;
    } else if (err instanceof ZodError) {
      appError = zodToAppError();
    } else if (err instanceof SyntaxError && "body" in err) {
      appError = new AppError("VALIDATION_ERROR", "Invalid JSON payload", 400);
    } else {
      appError = new AppError("INTERNAL_ERROR", "An unexpected error occurred", 500, {
        exposeMessage: false,
        cause: err,
      });
    }

    logger.error(
      {
        requestId: req.requestId,
        code: appError.code,
        statusCode: appError.statusCode,
        err: redactSensitive(
          err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
        ),
      },
      "request failed",
    );

    const body: ApiErrorResponse = {
      error: {
        code: appError.code,
        message:
          appError.exposeMessage && !isProduction
            ? appError.message
            : appError.exposeMessage
              ? appError.message
              : "An unexpected error occurred",
        requestId: req.requestId,
      },
    };

    if (appError.code === "INTERNAL_ERROR" && isProduction) {
      body.error.message = "An unexpected error occurred";
    }

    res.status(appError.statusCode).json(body);
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorResponse = {
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
      requestId: req.requestId,
    },
  };
  res.status(404).json(body);
}
