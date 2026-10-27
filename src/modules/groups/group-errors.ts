import { AppError } from "../../common/errors/app-error.js";
import { GROUP_NOT_FOUND_MESSAGE } from "./group.constants.js";

export function groupNotFound(): AppError {
  return new AppError("NOT_FOUND", GROUP_NOT_FOUND_MESSAGE, 404);
}

export function groupForbidden(message = "Group action is not available"): AppError {
  return new AppError("AUTH_FORBIDDEN", message, 403);
}

export function groupConflict(message: string): AppError {
  return new AppError("CONFLICT", message, 409);
}
