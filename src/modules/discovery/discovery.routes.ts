import { Router } from "express";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createDiscoveryController } from "./discovery.controller.js";

export function createDiscoverRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const discoveryController = createDiscoveryController({ db: deps.db });

  router.get("/people", authenticate, (req, res, next) => {
    void discoveryController.listPeople(req, res).catch(next);
  });

  return router;
}
