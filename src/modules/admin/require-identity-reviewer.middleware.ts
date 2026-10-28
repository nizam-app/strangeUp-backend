import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import {
  IDENTITY_REVIEWER_ROLE,
  userHasActivePlatformStaffRole,
} from "./platform-staff-policy.js";

export function createRequireIdentityReviewerMiddleware(db: DatabaseClient) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.authUser) {
      next(new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401));
      return;
    }
    const allowed = await userHasActivePlatformStaffRole(
      db,
      req.authUser.id,
      IDENTITY_REVIEWER_ROLE,
    );
    if (!allowed) {
      next(new AppError("AUTH_FORBIDDEN", "Administrator access required", 403));
      return;
    }
    next();
  };
}
