import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { userIsActiveSuperAdmin } from "./platform-staff-policy.js";

export function createRequireSuperAdminMiddleware(db: DatabaseClient) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.authUser) {
      next(new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401));
      return;
    }
    const allowed = await userIsActiveSuperAdmin(db, req.authUser.id);
    if (!allowed) {
      next(new AppError("AUTH_FORBIDDEN", "Super administrator access required", 403));
      return;
    }
    next();
  };
}
