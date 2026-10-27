import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import { createAuthController, type AuthController } from "./auth.controller.js";
import type { EmailSender } from "./email-sender.js";
import type { Logger } from "pino";

export function createAuthRouter(deps: {
  db: DatabaseClient;
  env: AppEnv;
  emailSender: EmailSender;
  logger: Logger;
  controller?: AuthController;
}): Router {
  const router = Router();
  const controller = deps.controller ?? createAuthController(deps);
  const authenticate = createAuthenticateMiddleware(controller.authService);

  router.post("/register", (req, res, next) => {
    void controller.register(req, res).catch(next);
  });
  router.post("/login", (req, res, next) => {
    void controller.login(req, res).catch(next);
  });
  router.post("/refresh", (req, res, next) => {
    void controller.refresh(req, res).catch(next);
  });
  router.post("/logout", authenticate, (req, res, next) => {
    void controller.logout(req, res).catch(next);
  });
  router.post("/logout-all", authenticate, (req, res, next) => {
    void controller.logoutAll(req, res).catch(next);
  });
  router.post("/email-verification/request", authenticate, (req, res, next) => {
    void controller.requestEmailVerification(req, res).catch(next);
  });
  router.post("/email-verification/confirm", (req, res, next) => {
    void controller.confirmEmailVerification(req, res).catch(next);
  });
  router.post("/password-reset/request", (req, res, next) => {
    void controller.requestPasswordReset(req, res).catch(next);
  });
  router.post("/password-reset/confirm", (req, res, next) => {
    void controller.confirmPasswordReset(req, res).catch(next);
  });

  return router;
}
