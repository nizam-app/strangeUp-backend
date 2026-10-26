import { Router } from "express";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createMeController } from "./me.controller.js";

export function createMeRouter(deps: { db: DatabaseClient; authService: AuthService }): Router {
  const router = Router();
  const controller = createMeController(deps);
  const authenticate = createAuthenticateMiddleware(deps.authService);

  router.get("/account", authenticate, (req, res, next) => {
    void controller.getAccount(req, res).catch(next);
  });
  router.get("/profile", authenticate, (req, res, next) => {
    void controller.getProfile(req, res).catch(next);
  });
  router.patch("/profile", authenticate, (req, res, next) => {
    void controller.patchProfile(req, res).catch(next);
  });

  return router;
}
