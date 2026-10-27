import { Router } from "express";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createPublicProfileController } from "./public-profile.controller.js";

export function createPublicUsersRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const publicProfileController = createPublicProfileController({
    db: deps.db,
    env: deps.env,
  });

  router.get("/:userId", authenticate, (req, res, next) => {
    void publicProfileController.getProfile(req, res).catch(next);
  });

  router.get("/:userId/avatar", authenticate, (req, res, next) => {
    void publicProfileController.getAvatar(req, res).catch(next);
  });

  return router;
}
