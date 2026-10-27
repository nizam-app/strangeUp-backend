import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createFavoriteActivitiesController } from "../favorite-activities/favorite-activities.controller.js";
import { createInterestsController } from "../interests/interests.controller.js";
import { createAvatarController } from "../profile-media/avatar.controller.js";
import { avatarUploadMiddleware } from "../profile-media/avatar-upload.middleware.js";
import { createAppMediaStorages } from "../../infrastructure/media-storage/create-media-storages.js";
import { createBlocksController } from "../blocks/blocks.controller.js";
import { createMeActivitiesRouter } from "../activities/activities.routes.js";
import { createMeSocialRouter } from "../social/social.routes.js";
import { createMeGroupsRouter } from "../groups/groups.routes.js";
import { createMeHomeRouter } from "../home/home.routes.js";
import { createMeStoreRouter } from "../store/store.routes.js";
import { createMeJobsRouter } from "../jobs/job.routes.js";
import { createNotificationController } from "../notifications/notification.controller.js";
import { createMeController } from "./me.controller.js";
import { createSavedActivitiesController } from "../saved-activities/saved-activity.controller.js";
import { createSettingsController } from "../settings/settings.controller.js";
import { createMeMembershipRouter } from "../membership/membership.routes.js";
import { createVerificationRouter } from "../verification/verification.routes.js";

export function createMeRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const controller = createMeController(deps);
  const interestsController = createInterestsController(deps);
  const favoriteActivitiesController = createFavoriteActivitiesController(deps);
  const mediaStorages = createAppMediaStorages(deps.env);
  const avatarController = createAvatarController({ db: deps.db, storage: mediaStorages.avatar });
  const blocksController = createBlocksController({ db: deps.db });
  const notificationController = createNotificationController({ db: deps.db });
  const savedActivitiesController = createSavedActivitiesController(deps);
  const settingsController = createSettingsController(deps);
  const authenticate = createAuthenticateMiddleware(deps.authService);

  router.use("/verification", createVerificationRouter(deps));

  router.get("/account", authenticate, (req, res, next) => {
    void controller.getAccount(req, res).catch(next);
  });
  router.get("/profile", authenticate, (req, res, next) => {
    void controller.getProfile(req, res).catch(next);
  });
  router.patch("/profile", authenticate, (req, res, next) => {
    void controller.patchProfile(req, res).catch(next);
  });
  router.post("/password-change", authenticate, (req, res, next) => {
    void controller.changePassword(req, res).catch(next);
  });

  router.get("/settings/overview", authenticate, (req, res, next) => {
    void settingsController.getOverview(req, res).catch(next);
  });
  router.use(createMeMembershipRouter(deps));
  router.get("/account-deletion/impact", authenticate, (req, res, next) => {
    void settingsController.getAccountDeletionImpact(req, res).catch(next);
  });
  router.get("/security/sessions", authenticate, (req, res, next) => {
    void settingsController.listSessions(req, res).catch(next);
  });
  router.delete("/security/sessions/:sessionId", authenticate, (req, res, next) => {
    void settingsController.revokeSession(req, res).catch(next);
  });
  router.post("/email-change/request", authenticate, (req, res, next) => {
    void settingsController.requestEmailChange(req, res).catch(next);
  });
  router.post("/email-change/confirm", authenticate, (req, res, next) => {
    void settingsController.confirmEmailChange(req, res).catch(next);
  });

  router.get("/saved-activities", authenticate, (req, res, next) => {
    void savedActivitiesController.listSaved(req, res).catch(next);
  });
  router.put("/saved-activities/:activityId", authenticate, (req, res, next) => {
    void savedActivitiesController.saveActivity(req, res).catch(next);
  });
  router.delete("/saved-activities/:activityId", authenticate, (req, res, next) => {
    void savedActivitiesController.unsaveActivity(req, res).catch(next);
  });
  router.get("/interests", authenticate, (req, res, next) => {
    void interestsController.getMyInterests(req, res).catch(next);
  });
  router.put("/interests", authenticate, (req, res, next) => {
    void interestsController.replaceMyInterests(req, res).catch(next);
  });
  router.get("/favorite-activities", authenticate, (req, res, next) => {
    void favoriteActivitiesController.getMyFavoriteActivities(req, res).catch(next);
  });
  router.put("/favorite-activities", authenticate, (req, res, next) => {
    void favoriteActivitiesController.replaceMyFavoriteActivities(req, res).catch(next);
  });
  router.get("/profile/avatar", authenticate, (req, res, next) => {
    void avatarController.getAvatar(req, res).catch(next);
  });
  router.post("/profile/avatar", authenticate, avatarUploadMiddleware, (req, res, next) => {
    void avatarController.uploadAvatar(req, res).catch(next);
  });
  router.delete("/profile/avatar", authenticate, (req, res, next) => {
    void avatarController.deleteAvatar(req, res).catch(next);
  });

  router.post("/blocks", authenticate, (req, res, next) => {
    void blocksController.blockUser(req, res).catch(next);
  });
  router.delete("/blocks/:targetUserId", authenticate, (req, res, next) => {
    void blocksController.unblockUser(req, res).catch(next);
  });
  router.get("/blocks", authenticate, (req, res, next) => {
    void blocksController.listBlocks(req, res).catch(next);
  });

  router.get("/notifications", authenticate, (req, res, next) => {
    void notificationController.list(req, res).catch(next);
  });
  router.post("/notifications/read-all", authenticate, (req, res, next) => {
    void notificationController.markAllRead(req, res).catch(next);
  });
  router.post("/notifications/:notificationId/read", authenticate, (req, res, next) => {
    void notificationController.markRead(req, res).catch(next);
  });

  router.use(createMeActivitiesRouter(deps));
  router.use(createMeSocialRouter(deps));
  router.use(createMeGroupsRouter(deps));
  router.use(createMeHomeRouter(deps));
  router.use(createMeStoreRouter(deps));
  router.use(createMeJobsRouter(deps));

  return router;
}
