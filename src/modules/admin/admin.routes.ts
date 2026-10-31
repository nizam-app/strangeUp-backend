import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createIdentityAdminReviewController } from "./identity-admin-review.controller.js";
import { createManualKycAdminController } from "./manual-kyc-admin.controller.js";
import { createRequireIdentityReviewerMiddleware } from "./require-identity-reviewer.middleware.js";
import { createRequireSuperAdminMiddleware } from "./require-super-admin.middleware.js";
import { createStoreCatalogAdminRouter } from "../store/store-catalog-admin.routes.js";
import { createAppMediaStorages } from "../../infrastructure/media-storage/create-media-storages.js";
import { createAdminUsersController } from "./admin-users.controller.js";
import { createAdminActivitiesController } from "./admin-activities.controller.js";
import { createAdminDashboardController } from "./admin-dashboard.controller.js";

export function createAdminRouter(deps: {
  db: DatabaseClient;
  env: AppEnv;
  authService: AuthService;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const requireReviewer = createRequireIdentityReviewerMiddleware(deps.db);
  const mediaStorages = createAppMediaStorages(deps.env);
  const avatarStorage = mediaStorages.avatar;
  const controller = createIdentityAdminReviewController({ ...deps, avatarStorage });
  const manualKycAdmin = createManualKycAdminController(deps);

  const identityReviews = Router();
  identityReviews.use(authenticate, requireReviewer);

  identityReviews.get("/summary", (req, res, next) => {
    void controller.summary(req, res).catch(next);
  });
  identityReviews.get("/", (req, res, next) => {
    void controller.list(req, res).catch(next);
  });
  identityReviews.get("/export", (req, res, next) => {
    void controller.exportCsv(req, res).catch(next);
  });
  identityReviews.post("/batch-decide", (req, res, next) => {
    void controller.batchDecide(req, res).catch(next);
  });
  identityReviews.get("/:reviewId/notes", (req, res, next) => {
    void controller.listNotes(req, res).catch(next);
  });
  identityReviews.get("/:reviewId/decisions", (req, res, next) => {
    void controller.listDecisions(req, res).catch(next);
  });
  identityReviews.post("/:reviewId/notes", (req, res, next) => {
    void controller.createNote(req, res).catch(next);
  });
  identityReviews.get("/:reviewId/avatar", (req, res, next) => {
    void controller.avatar(req, res).catch(next);
  });
  identityReviews.get("/:reviewId/manual-evidence", (req, res, next) => {
    void manualKycAdmin.listManualEvidence(req, res).catch(next);
  });
  identityReviews.get("/:reviewId/manual-evidence/:evidenceId", (req, res, next) => {
    void manualKycAdmin.getManualEvidenceBytes(req, res).catch(next);
  });
  identityReviews.delete("/:reviewId/manual-evidence/:evidenceId", (req, res, next) => {
    void manualKycAdmin.deleteManualEvidence(req, res).catch(next);
  });
  identityReviews.post("/:reviewId/manual-identity-decision", (req, res, next) => {
    void manualKycAdmin.manualIdentityDecision(req, res).catch(next);
  });
  identityReviews.post("/:reviewId/needs-further-review", (req, res, next) => {
    void controller.needsFurtherReview(req, res).catch(next);
  });
  identityReviews.post("/:reviewId/return-to-pending", (req, res, next) => {
    void controller.returnToPending(req, res).catch(next);
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

  const dashboard = Router();
  dashboard.use(authenticate, requireReviewer);
  const dashboardController = createAdminDashboardController(deps);
  dashboard.get("/overview", (req, res, next) => {
    void dashboardController.overview(req, res).catch(next);
  });
  dashboard.get("/growth", (req, res, next) => {
    void dashboardController.growth(req, res).catch(next);
  });
  dashboard.get("/activity-categories", (req, res, next) => {
    void dashboardController.activityCategories(req, res).catch(next);
  });
  dashboard.get("/verification-queue", (req, res, next) => {
    void dashboardController.verificationQueue(req, res).catch(next);
  });
  dashboard.get("/recent-events", (req, res, next) => {
    void dashboardController.recentEvents(req, res).catch(next);
  });
  dashboard.get("/export", (req, res, next) => {
    void dashboardController.exportCsv(req, res).catch(next);
  });
  router.use("/dashboard", dashboard);

  const adminUsers = Router();
  adminUsers.use(authenticate, requireReviewer);
  const requireSuperAdmin = createRequireSuperAdminMiddleware(deps.db);
  const usersController = createAdminUsersController(deps);
  adminUsers.get("/summary", (req, res, next) => {
    void usersController.summary(req, res).catch(next);
  });
  adminUsers.get("/", (req, res, next) => {
    void usersController.list(req, res).catch(next);
  });
  adminUsers.post("/:userId/suspend", requireSuperAdmin, (req, res, next) => {
    void usersController.suspend(req, res).catch(next);
  });
  adminUsers.post("/:userId/restore", requireSuperAdmin, (req, res, next) => {
    void usersController.restore(req, res).catch(next);
  });
  adminUsers.get("/:userId", (req, res, next) => {
    void usersController.detail(req, res).catch(next);
  });
  router.use("/users", adminUsers);

  const adminActivities = Router();
  adminActivities.use(authenticate, requireReviewer);
  const activitiesController = createAdminActivitiesController({
    db: deps.db,
    activityCoverStorage: mediaStorages.activityCover,
  });
  adminActivities.get("/summary", (req, res, next) => {
    void activitiesController.summary(req, res).catch(next);
  });
  adminActivities.get("/export", (req, res, next) => {
    void activitiesController.exportCsv(req, res).catch(next);
  });
  adminActivities.get("/", (req, res, next) => {
    void activitiesController.list(req, res).catch(next);
  });
  adminActivities.get("/:activityId/cover", (req, res, next) => {
    void activitiesController.cover(req, res).catch(next);
  });
  adminActivities.get("/:activityId", (req, res, next) => {
    void activitiesController.detail(req, res).catch(next);
  });
  adminActivities.post("/:activityId/cancel", requireSuperAdmin, (req, res, next) => {
    void activitiesController.cancel(req, res).catch(next);
  });
  router.use("/activities", adminActivities);

  router.use("/store-catalog", createStoreCatalogAdminRouter(deps));
  return router;
}
