import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { LocalAvatarStorage } from "../profile-media/local-avatar-storage.js";
import { PublicProfileService } from "./public-profile.service.js";
import { publicUserIdParamSchema } from "./discovery.validation.js";

export function createPublicProfileController(deps: { db: DatabaseClient; env: AppEnv }) {
  const storage = new LocalAvatarStorage(deps.env.PROFILE_UPLOAD_DIR);
  const service = new PublicProfileService(deps.db, storage);

  return {
    getProfile: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const { userId } = publicUserIdParamSchema.parse(req.params);
      const profile = await service.getPublicProfile(req.authUser, userId);
      res.status(200).json({ data: profile, meta: { requestId: req.requestId } });
    },

    getAvatar: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const { userId } = publicUserIdParamSchema.parse(req.params);
      const { buffer, contentType } = await service.getPublicAvatarBytes(req.authUser, userId);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Disposition", "inline");
      res.status(200).send(buffer);
    },
  };
}
