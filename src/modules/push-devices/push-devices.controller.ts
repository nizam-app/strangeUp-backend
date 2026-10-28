import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { DeviceTokenService } from "./device-token.service.js";
import { NotificationPreferenceService } from "./notification-preference.service.js";
import {
  deviceTokenIdParamSchema,
  registerDeviceTokenBodySchema,
} from "./device-token.validation.js";
import { patchNotificationPreferenceBodySchema } from "./notification-preference.validation.js";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createPushDevicesController(deps: { db: DatabaseClient; env: AppEnv }) {
  const deviceTokens = new DeviceTokenService(deps.db);
  const preferences = new NotificationPreferenceService(deps.db, deps.env);

  return {
    registerDeviceToken: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const body = registerDeviceTokenBodySchema.parse(req.body);
      const data = await deviceTokens.register(requireUser(req), req.authSessionId, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listDeviceTokens: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const devices = await deviceTokens.list(requireUser(req));
      res.status(200).json({ data: { devices }, meta: { requestId: req.requestId } });
    },

    revokeDeviceToken: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { deviceTokenId } = deviceTokenIdParamSchema.parse(req.params);
      const data = await deviceTokens.revoke(requireUser(req), deviceTokenId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    getNotificationPreferences: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await preferences.get(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    patchNotificationPreferences: async (
      req: AuthenticatedRequest,
      res: Response,
    ): Promise<void> => {
      const body = patchNotificationPreferenceBodySchema.parse(req.body);
      const data = await preferences.patch(requireUser(req), body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
