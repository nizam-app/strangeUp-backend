import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { LocalAvatarStorage } from "./local-avatar-storage.js";
import { AvatarService } from "./avatar.service.js";

export function createAvatarController(deps: { db: DatabaseClient; storage: LocalAvatarStorage }) {
  const service = new AvatarService(deps.db, deps.storage);

  return {
    getAvatar: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const { buffer, contentType } = await service.getAvatarBytes(req.authUser);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).send(buffer);
    },

    uploadAvatar: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const file = req.file;
      if (!file?.buffer) {
        throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
      }
      const data = await service.replaceAvatar(req.authUser, {
        buffer: file.buffer,
      });
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    deleteAvatar: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const data = await service.deleteAvatar(req.authUser);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
