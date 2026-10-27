import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createVerificationController } from "./verification.controller.js";

export function createVerificationRouter(deps: {
  db: DatabaseClient;
  env: AppEnv;
  authService: AuthService;
}): Router {
  const router = Router();
  const controller = createVerificationController(deps);
  const authenticate = createAuthenticateMiddleware(deps.authService);

  router.get("/status", authenticate, (req, res, next) => {
    void controller.getStatus(req, res).catch(next);
  });
  router.post("/sessions", authenticate, (req, res, next) => {
    void controller.startSession(req, res).catch(next);
  });
  router.get("/sessions/:sessionId", authenticate, (req, res, next) => {
    void controller.getSession(req, res).catch(next);
  });
  router.post("/sessions/:sessionId/cancel", authenticate, (req, res, next) => {
    void controller.cancelSession(req, res).catch(next);
  });

  return router;
}
