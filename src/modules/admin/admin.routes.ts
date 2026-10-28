import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createIdentityAdminReviewController } from "./identity-admin-review.controller.js";
import { createRequireIdentityReviewerMiddleware } from "./require-identity-reviewer.middleware.js";

export function createAdminRouter(deps: {
  db: DatabaseClient;
  env: AppEnv;
  authService: AuthService;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const requireReviewer = createRequireIdentityReviewerMiddleware(deps.db);
  const controller = createIdentityAdminReviewController(deps);

  const identityReviews = Router();
  identityReviews.use(authenticate, requireReviewer);

  identityReviews.get("/", (req, res, next) => {
    void controller.list(req, res).catch(next);
  });
  identityReviews.get("/:reviewId", (req, res, next) => {
    void controller.detail(req, res).catch(next);
  });
  identityReviews.post("/:reviewId/approve", (req, res, next) => {
    void controller.approve(req, res).catch(next);
  });
  identityReviews.post("/:reviewId/reject", (req, res, next) => {
    void controller.reject(req, res).catch(next);
  });

  router.use("/identity-reviews", identityReviews);
  return router;
}
