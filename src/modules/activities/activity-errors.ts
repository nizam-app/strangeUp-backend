import { AppError } from "../../common/errors/app-error.js";
import { ACTIVITY_NOT_FOUND_MESSAGE } from "./activity.constants.js";

export function activityNotFound(): AppError {
  return new AppError("NOT_FOUND", ACTIVITY_NOT_FOUND_MESSAGE, 404);
}

export function activityKycRequired(): AppError {
  return new AppError(
    "IDENTITY_VERIFICATION_REQUIRED",
    "Current government-ID verification is required for this real-world activity action",
    403,
  );
}

export function activityForbidden(message = "Activity action is not available"): AppError {
  return new AppError("AUTH_FORBIDDEN", message, 403);
}
