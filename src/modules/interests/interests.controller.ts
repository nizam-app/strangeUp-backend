import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { InterestsService } from "./interests.service.js";
import { replaceInterestsBodySchema } from "./interests.validation.js";

export function createInterestsController(deps: { db: DatabaseClient }) {
  const interestsService = new InterestsService(deps.db);

  return {
    listCatalog: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const data = await interestsService.listCatalog(req.authUser);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    getMyInterests: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const data = await interestsService.getMyInterests(req.authUser);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    replaceMyInterests: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const body = replaceInterestsBodySchema.parse(req.body);
      const data = await interestsService.replaceMyInterests(req.authUser, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
