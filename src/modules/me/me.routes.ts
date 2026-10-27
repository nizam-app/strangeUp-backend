import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createFavoriteActivitiesController } from "../favorite-activities/favorite-activities.controller.js";
import { createInterestsController } from "../interests/interests.controller.js";
import { createAvatarController } from "../profile-media/avatar.controller.js";
import { avatarUploadMiddleware } from "../profile-media/avatar-upload.middleware.js";
import { LocalAvatarStorage } from "../profile-media/local-avatar-storage.js";
import { createBlocksController } from "../blocks/blocks.controller.js";
import { createMeActivitiesRouter } from "../activities/activities.routes.js";
import { createMeSocialRouter } from "../social/social.routes.js";
import { createMeGroupsRouter } from "../groups/groups.routes.js";
import { createMeController } from "./me.controller.js";

export function createMeRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const controller = createMeController(deps);
  const interestsController = createInterestsController(deps);
  const favoriteActivitiesController = createFavoriteActivitiesController(deps);
  const avatarStorage = new LocalAvatarStorage(deps.env.PROFILE_UPLOAD_DIR);
  const avatarController = createAvatarController({ db: deps.db, storage: avatarStorage });
  const blocksController = createBlocksController({ db: deps.db });
  const authenticate = createAuthenticateMiddleware(deps.authService);

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

  router.use(createMeActivitiesRouter(deps));
  router.use(createMeSocialRouter(deps));
  router.use(createMeGroupsRouter(deps));

  return router;
}
