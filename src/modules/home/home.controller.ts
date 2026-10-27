import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { CommunityFeedService } from "./community-feed.service.js";
import { HomeService } from "./home.service.js";
import { communityFeedQuerySchema } from "./home.validation.js";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createHomeController(deps: { db: DatabaseClient; env: AppEnv }) {
  const homeService = new HomeService(deps.db, deps.env);
  const feedService = new CommunityFeedService(deps.db, deps.env);

  return {
    getDashboard: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await homeService.getDashboard(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    getCommunityFeed: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = communityFeedQuerySchema.parse(req.query);
      const result = await feedService.list(requireUser(req), query);
      res.status(200).json({
        data: { items: result.items },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },
  };
}
