import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./authenticate.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { assertMainAppHomeAccess } from "../../modules/policy/home-access-enforcement.js";
import { AppError } from "../errors/app-error.js";

export function createRequireHomeAccessMiddleware(deps: { db: DatabaseClient; env: AppEnv }) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.authUser) {
      next(new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401));
      return;
    }
    try {
      const fresh = await assertMainAppHomeAccess(deps.db, deps.env, req.authUser.id);
      req.authUser = fresh;
      next();
    } catch (err) {
      next(err);
    }
  };
}
