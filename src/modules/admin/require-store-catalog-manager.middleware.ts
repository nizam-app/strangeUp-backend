import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import {
  STORE_CATALOG_MANAGER_ROLE,
  userHasActivePlatformStaffRole,
} from "./platform-staff-policy.js";

export function createRequireStoreCatalogManagerMiddleware(db: DatabaseClient) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.authUser) {
      next(new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401));
      return;
    }
    const allowed = await userHasActivePlatformStaffRole(
      db,
      req.authUser.id,
      STORE_CATALOG_MANAGER_ROLE,
    );
    if (!allowed) {
      next(new AppError("AUTH_FORBIDDEN", "Store catalog management access required", 403));
      return;
    }
    next();
  };
}
