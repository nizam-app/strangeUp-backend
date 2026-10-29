import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { SavedActivityService } from "./saved-activity.service.js";
import {
  savedActivityIdParamSchema,
  savedActivityListQuerySchema,
} from "./saved-activity.validation.js";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createSavedActivitiesController(deps: { db: DatabaseClient; env: AppEnv }) {
  const service = new SavedActivityService(deps.db, {
    isProduction: deps.env.isProduction,
    kycProviderEnabled: deps.env.KYC_PROVIDER_ENABLED,
  });

  return {
    listSaved: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = savedActivityListQuerySchema.parse(req.query);
      const result = await service.listSaved(requireUser(req), query);
      res.status(200).json({
        data: { activities: result.activities },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    saveActivity: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = savedActivityIdParamSchema.parse(req.params);
      const data = await service.saveActivity(requireUser(req), activityId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    unsaveActivity: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = savedActivityIdParamSchema.parse(req.params);
      const data = await service.unsaveActivity(requireUser(req), activityId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
