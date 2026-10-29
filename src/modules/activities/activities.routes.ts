import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { activityCoverUploadMiddleware } from "./activity-cover-upload.middleware.js";
import { createActivitiesControllers } from "./activities.controller.js";

export function createActivitiesRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createActivitiesControllers(deps);

  router.get("/", authenticate, (req, res, next) => {
    void controller.listDiscoverable(req, res).catch(next);
  });
  router.get("/:activityId", authenticate, (req, res, next) => {
    void controller.getPublicDetail(req, res).catch(next);
  });
  router.get("/:activityId/cover", authenticate, (req, res, next) => {
    void controller.getPublicCover(req, res).catch(next);
  });
  router.get("/:activityId/participants", authenticate, (req, res, next) => {
    void controller.listActivityParticipants(req, res).catch(next);
  });
  router.get("/:activityId/meeting", authenticate, (req, res, next) => {
    void controller.getMeeting(req, res).catch(next);
  });
  router.post("/:activityId/rsvp", authenticate, (req, res, next) => {
    void controller.rsvp(req, res).catch(next);
  });
  router.delete("/:activityId/rsvp", authenticate, (req, res, next) => {
    void controller.leave(req, res).catch(next);
  });

  return router;
}

export function createActivityCategoriesRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createActivitiesControllers(deps);

  router.get("/", authenticate, (req, res, next) => {
    void controller.listCategories(req, res).catch(next);
  });

  return router;
}

export function createMeActivitiesRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createActivitiesControllers(deps);

  router.get("/activity-inventory", authenticate, (req, res, next) => {
    void controller.listMyActivityInventory(req, res).catch(next);
  });
  router.get("/activities", authenticate, (req, res, next) => {
    void controller.listMine(req, res).catch(next);
  });
  router.post("/activities", authenticate, (req, res, next) => {
    void controller.createDraft(req, res).catch(next);
  });
  router.get("/activities/:activityId/join-requests", authenticate, (req, res, next) => {
    void controller.listHostJoinRequests(req, res).catch(next);
  });
  router.post(
    "/activities/:activityId/join-requests/:userId/approve",
    authenticate,
    (req, res, next) => {
      void controller.approveHostJoinRequest(req, res).catch(next);
    },
  );
  router.post(
    "/activities/:activityId/join-requests/:userId/decline",
    authenticate,
    (req, res, next) => {
      void controller.declineHostJoinRequest(req, res).catch(next);
    },
  );
  router.get("/activities/:activityId", authenticate, (req, res, next) => {
    void controller.getMine(req, res).catch(next);
  });
  router.patch("/activities/:activityId", authenticate, (req, res, next) => {
    void controller.patchMine(req, res).catch(next);
  });
  router.post("/activities/:activityId/publish", authenticate, (req, res, next) => {
    void controller.publishMine(req, res).catch(next);
  });
  router.post("/activities/:activityId/cancel", authenticate, (req, res, next) => {
    void controller.cancelMine(req, res).catch(next);
  });
  router.get("/activities/:activityId/cover", authenticate, (req, res, next) => {
    void controller.getOwnCover(req, res).catch(next);
  });
  router.post(
    "/activities/:activityId/cover",
    authenticate,
    activityCoverUploadMiddleware,
    (req, res, next) => {
      void controller.uploadCover(req, res).catch(next);
    },
  );
  router.delete("/activities/:activityId/cover", authenticate, (req, res, next) => {
    void controller.deleteCover(req, res).catch(next);
  });
  router.get("/activity-rsvps", authenticate, (req, res, next) => {
    void controller.listMyRsvps(req, res).catch(next);
  });

  return router;
}
