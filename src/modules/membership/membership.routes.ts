import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createMembershipController } from "./membership.controller.js";

export function createMembershipRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createMembershipController(deps);

  router.get("/plans", authenticate, (req, res, next) => {
    try {
      controller.listPlans(req, res);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function createMeMembershipRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createMembershipController(deps);

  router.get("/membership", authenticate, (req, res, next) => {
    try {
      controller.getMyMembership(req, res);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
