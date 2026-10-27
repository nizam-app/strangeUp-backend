import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { FavoriteActivitiesService } from "./favorite-activities.service.js";
import { replaceFavoriteActivitiesBodySchema } from "./favorite-activities.validation.js";

export function createFavoriteActivitiesController(deps: { db: DatabaseClient }) {
  const service = new FavoriteActivitiesService(deps.db);

  return {
    getMyFavoriteActivities: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const data = await service.getMyFavoriteActivities(req.authUser);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    replaceMyFavoriteActivities: async (
      req: AuthenticatedRequest,
      res: Response,
    ): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const body = replaceFavoriteActivitiesBodySchema.parse(req.body);
      const data = await service.replaceMyFavoriteActivities(req.authUser, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
