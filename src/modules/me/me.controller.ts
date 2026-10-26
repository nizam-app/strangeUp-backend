import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AuthService } from "../auth/auth.service.js";
import { MeService } from "./me.service.js";
import { profilePatchSchema } from "./me.validation.js";

export function createMeController(deps: { db: DatabaseClient; authService: AuthService }) {
  const meService = new MeService(deps.db);

  return {
    getAccount: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const account = await meService.getAccount(req.authUser);
      res.status(200).json({ data: account, meta: { requestId: req.requestId } });
    },

    getProfile: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const profile = await meService.getProfile(req.authUser);
      res.status(200).json({ data: profile, meta: { requestId: req.requestId } });
    },

    patchProfile: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const body = profilePatchSchema.parse(req.body);
      const profile = await meService.patchProfile(req.authUser, body);
      res.status(200).json({ data: profile, meta: { requestId: req.requestId } });
    },
  };
}
