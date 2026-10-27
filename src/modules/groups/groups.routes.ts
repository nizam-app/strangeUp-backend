import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { groupCoverUploadMiddleware } from "./group-cover-upload.middleware.js";
import { groupContentImageUploadMiddleware } from "../group-content/group-content-upload.middleware.js";
import { createGroupsControllers } from "./groups.controller.js";

export function createGroupsRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createGroupsControllers(deps);

  router.get("/", authenticate, (req, res, next) => {
    void controller.listDiscoverable(req, res).catch(next);
  });
  router.get("/:groupId", authenticate, (req, res, next) => {
    void controller.getDetail(req, res).catch(next);
  });
  router.get("/:groupId/cover", authenticate, (req, res, next) => {
    void controller.getCover(req, res).catch(next);
  });
  router.post("/:groupId/join", authenticate, (req, res, next) => {
    void controller.join(req, res).catch(next);
  });
  router.delete("/:groupId/join", authenticate, (req, res, next) => {
    void controller.leave(req, res).catch(next);
  });
  router.get("/:groupId/members", authenticate, (req, res, next) => {
    void controller.listMembers(req, res).catch(next);
  });
  router.get("/:groupId/posts", authenticate, (req, res, next) => {
    void controller.listPosts(req, res).catch(next);
  });
  router.post("/:groupId/posts", authenticate, (req, res, next) => {
    void controller.createPost(req, res).catch(next);
  });
  router.patch("/:groupId/posts/:postId", authenticate, (req, res, next) => {
    void controller.patchPost(req, res).catch(next);
  });
  router.delete("/:groupId/posts/:postId", authenticate, (req, res, next) => {
    void controller.removePost(req, res).catch(next);
  });
  router.post("/:groupId/posts/:postId/pin", authenticate, (req, res, next) => {
    void controller.pinPost(req, res).catch(next);
  });
  router.get("/:groupId/posts/:postId/comments", authenticate, (req, res, next) => {
    void controller.listComments(req, res).catch(next);
  });
  router.post("/:groupId/posts/:postId/comments", authenticate, (req, res, next) => {
    void controller.createComment(req, res).catch(next);
  });
  router.delete("/:groupId/posts/:postId/comments/:commentId", authenticate, (req, res, next) => {
    void controller.removeComment(req, res).catch(next);
  });
  router.put("/:groupId/posts/:postId/like", authenticate, (req, res, next) => {
    void controller.like(req, res).catch(next);
  });
  router.delete("/:groupId/posts/:postId/like", authenticate, (req, res, next) => {
    void controller.unlike(req, res).catch(next);
  });
  router.get("/:groupId/chat/messages", authenticate, (req, res, next) => {
    void controller.listMessages(req, res).catch(next);
  });
  router.post("/:groupId/chat/messages", authenticate, (req, res, next) => {
    void controller.sendMessage(req, res).catch(next);
  });
  router.post("/:groupId/chat/read", authenticate, (req, res, next) => {
    void controller.markRead(req, res).catch(next);
  });
  router.get("/:groupId/activities", authenticate, (req, res, next) => {
    void controller.listActivities(req, res).catch(next);
  });
  router.post(
    "/:groupId/posts/:postId/media",
    authenticate,
    groupContentImageUploadMiddleware,
    (req, res, next) => {
      void controller.attachPostMedia(req, res).catch(next);
    },
  );
  router.get("/:groupId/posts/:postId/media/:mediaId", authenticate, (req, res, next) => {
    void controller.getPostMedia(req, res).catch(next);
  });
  router.delete("/:groupId/posts/:postId/media/:mediaId", authenticate, (req, res, next) => {
    void controller.removePostMedia(req, res).catch(next);
  });
  router.get("/:groupId/stories", authenticate, (req, res, next) => {
    void controller.listStories(req, res).catch(next);
  });
  router.post(
    "/:groupId/stories",
    authenticate,
    groupContentImageUploadMiddleware,
    (req, res, next) => {
      void controller.createStory(req, res).catch(next);
    },
  );
  router.get("/:groupId/stories/:storyId/media", authenticate, (req, res, next) => {
    void controller.getStoryMedia(req, res).catch(next);
  });
  router.delete("/:groupId/stories/:storyId", authenticate, (req, res, next) => {
    void controller.removeStory(req, res).catch(next);
  });
  router.post("/:groupId/posts/:postId/poll", authenticate, (req, res, next) => {
    void controller.createPoll(req, res).catch(next);
  });
  router.get("/:groupId/posts/:postId/poll", authenticate, (req, res, next) => {
    void controller.getPoll(req, res).catch(next);
  });
  router.put("/:groupId/posts/:postId/poll/vote", authenticate, (req, res, next) => {
    void controller.votePoll(req, res).catch(next);
  });
  router.post("/:groupId/content-reports", authenticate, (req, res, next) => {
    void controller.createContentReport(req, res).catch(next);
  });
  router.get("/:groupId/content-reports", authenticate, (req, res, next) => {
    void controller.listContentReports(req, res).catch(next);
  });

  return router;
}

export function createGroupCategoriesRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createGroupsControllers(deps);

  router.get("/", authenticate, (req, res, next) => {
    void controller.listCategories(req, res).catch(next);
  });

  return router;
}

export function createMeGroupsRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createGroupsControllers(deps);

  router.get("/groups", authenticate, (req, res, next) => {
    void controller.listMine(req, res).catch(next);
  });
  router.post("/groups", authenticate, (req, res, next) => {
    void controller.create(req, res).catch(next);
  });
  router.get("/groups/:groupId/manage", authenticate, (req, res, next) => {
    void controller.getManage(req, res).catch(next);
  });
  router.patch("/groups/:groupId", authenticate, (req, res, next) => {
    void controller.patch(req, res).catch(next);
  });
  router.post(
    "/groups/:groupId/cover",
    authenticate,
    groupCoverUploadMiddleware,
    (req, res, next) => {
      void controller.uploadCover(req, res).catch(next);
    },
  );
  router.delete("/groups/:groupId/cover", authenticate, (req, res, next) => {
    void controller.deleteCover(req, res).catch(next);
  });
  router.get("/groups/:groupId/join-requests", authenticate, (req, res, next) => {
    void controller.listJoinRequests(req, res).catch(next);
  });
  router.post(
    "/groups/:groupId/join-requests/:memberId/approve",
    authenticate,
    (req, res, next) => {
      void controller.approve(req, res).catch(next);
    },
  );
  router.post(
    "/groups/:groupId/join-requests/:memberId/decline",
    authenticate,
    (req, res, next) => {
      void controller.decline(req, res).catch(next);
    },
  );
  router.post("/groups/:groupId/members/:userId/remove", authenticate, (req, res, next) => {
    void controller.removeMember(req, res).catch(next);
  });
  router.post("/groups/:groupId/members/:userId/role", authenticate, (req, res, next) => {
    void controller.changeRole(req, res).catch(next);
  });
  router.post("/groups/:groupId/transfer-ownership", authenticate, (req, res, next) => {
    void controller.transferOwnership(req, res).catch(next);
  });
  router.post("/groups/:groupId/archive", authenticate, (req, res, next) => {
    void controller.archive(req, res).catch(next);
  });
  router.post("/groups/:groupId/activities", authenticate, (req, res, next) => {
    void controller.attachActivity(req, res).catch(next);
  });
  router.delete("/groups/:groupId/activities/:activityId", authenticate, (req, res, next) => {
    void controller.detachActivity(req, res).catch(next);
  });
  router.get("/group-chats", authenticate, (req, res, next) => {
    void controller.listChats(req, res).catch(next);
  });

  return router;
}
