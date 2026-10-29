import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createDiscoveryController } from "./discovery.controller.js";

export function createDiscoverRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const discoveryController = createDiscoveryController(deps);

  router.get("/people", authenticate, (req, res, next) => {
    void discoveryController.listPeople(req, res).catch(next);
  });

  return router;
}
