import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { DiscoveryService } from "./discovery.service.js";
import { discoverPeopleQuerySchema } from "./discovery.validation.js";

export function createDiscoveryController(deps: { db: DatabaseClient; env: AppEnv }) {
  const service = new DiscoveryService(deps.db, deps.env);

  return {
    listPeople: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const query = discoverPeopleQuerySchema.parse(req.query);
      const result = await service.listDiscoverablePeople(req.authUser, query);
      res.status(200).json({
        data: { people: result.people },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },
  };
}
