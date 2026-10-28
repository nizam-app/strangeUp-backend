import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createPushDevicesController } from "./push-devices.controller.js";

export function createPushDevicesRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createPushDevicesController(deps);

  router.post("/device-tokens", authenticate, (req, res, next) => {
    void controller.registerDeviceToken(req, res).catch(next);
  });
  router.get("/device-tokens", authenticate, (req, res, next) => {
    void controller.listDeviceTokens(req, res).catch(next);
  });
  router.delete("/device-tokens/:deviceTokenId", authenticate, (req, res, next) => {
    void controller.revokeDeviceToken(req, res).catch(next);
  });
  router.get("/notification-preferences", authenticate, (req, res, next) => {
    void controller.getNotificationPreferences(req, res).catch(next);
  });
  router.patch("/notification-preferences", authenticate, (req, res, next) => {
    void controller.patchNotificationPreferences(req, res).catch(next);
  });

  return router;
}
