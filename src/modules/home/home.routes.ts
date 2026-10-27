import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createHomeController } from "./home.controller.js";

export function createHomeRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createHomeController(deps);

  router.get("/", authenticate, (req, res, next) => {
    void controller.getDashboard(req, res).catch(next);
  });

  return router;
}

export function createMeHomeRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createHomeController(deps);

  router.get("/community-feed", authenticate, (req, res, next) => {
    void controller.getCommunityFeed(req, res).catch(next);
  });

  return router;
}
