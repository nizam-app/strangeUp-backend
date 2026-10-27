import { AppError } from "../../common/errors/app-error.js";
import type { AppEnv } from "../../config/env.js";

/** Email change requires a transport that can hand off messages (dev stub or approved provider). */
export function assertEmailChangeAvailable(env: AppEnv): void {
  if (!env.transactionalEmail.canHandOff) {
    throw new AppError(
      "FEATURE_DISABLED",
      "Email change is not available until transactional email is configured",
      403,
    );
  }
}
