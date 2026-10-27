import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AuthService } from "../auth/auth.service.js";
import { passwordChangeBodySchema } from "../auth/auth.validation.js";
import { checkRateLimit } from "../auth/rate-limit.js";
import { canChangePassword, toPolicyActor } from "../policy/account-policy.js";
import { MeService } from "./me.service.js";
import { profilePatchSchema } from "./me.validation.js";

function clientIp(req: AuthenticatedRequest): string {
  return req.ip ?? "unknown";
}

export function createMeController(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}) {
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

    changePassword: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const actor = toPolicyActor(req.authUser);
      if (!canChangePassword(actor, req.authUser.id)) {
        throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
      }

      const ip = clientIp(req);
      const ipLimit = checkRateLimit(
        `password-change:ip:${ip}`,
        deps.env.auth.AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_IP,
        60_000,
      );
      if (!ipLimit.allowed) {
        throw new AppError("AUTH_RATE_LIMITED", "Too many requests", 429);
      }
      const userLimit = checkRateLimit(
        `password-change:user:${req.authUser.id}`,
        deps.env.auth.AUTH_RATE_LIMIT_PASSWORD_CHANGE_PER_USER,
        60_000,
      );
      if (!userLimit.allowed) {
        throw new AppError("AUTH_RATE_LIMITED", "Too many requests", 429);
      }

      const body = passwordChangeBodySchema.parse(req.body);
      await deps.authService.changePassword(
        req.authUser.id,
        body.currentPassword,
        body.newPassword,
      );
      res.status(200).json({
        data: { success: true, sessionsRevoked: true },
        meta: { requestId: req.requestId },
      });
    },
  };
}
