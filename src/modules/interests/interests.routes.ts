import { Router } from "express";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AuthService } from "../auth/auth.service.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import { createInterestsController } from "./interests.controller.js";

export function createInterestsRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
}): Router {
  const router = Router();
  const controller = createInterestsController(deps);
  const authenticate = createAuthenticateMiddleware(deps.authService);

  router.get("/", authenticate, (req, res, next) => {
    void controller.listCatalog(req, res).catch(next);
  });

  return router;
}
