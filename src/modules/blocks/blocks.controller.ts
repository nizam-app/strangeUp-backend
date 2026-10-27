import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { BlocksService } from "./blocks.service.js";
import {
  blockTargetParamSchema,
  blockUserBodySchema,
  listBlocksQuerySchema,
} from "./blocks.validation.js";

export function createBlocksController(deps: { db: DatabaseClient }) {
  const service = new BlocksService(deps.db);

  return {
    blockUser: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const body = blockUserBodySchema.parse(req.body);
      await service.blockUser(req.authUser, body);
      res.status(200).json({
        data: { blocked: true, targetUserId: body.targetUserId },
        meta: { requestId: req.requestId },
      });
    },

    unblockUser: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const { targetUserId } = blockTargetParamSchema.parse(req.params);
      await service.unblockUser(req.authUser, targetUserId);
      res.status(200).json({
        data: { blocked: false, targetUserId },
        meta: { requestId: req.requestId },
      });
    },

    listBlocks: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const query = listBlocksQuerySchema.parse(req.query);
      const result = await service.listBlocks(req.authUser, query);
      res.status(200).json({
        data: { blocks: result.blocks },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },
  };
}
