import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { OnboardingService } from "./onboarding.service.js";

export function createOnboardingController(deps: { db: DatabaseClient; env: AppEnv }) {
  const service = new OnboardingService(deps.db, deps.env);

  return {
    getStatus: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const data = await service.getStatus(req.authUser);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
