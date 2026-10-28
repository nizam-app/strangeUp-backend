import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createSocialControllers } from "./social.controller.js";

export function createSocialUsersRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createSocialControllers(deps);

  router.post("/:userId/follow", authenticate, (req, res, next) => {
    void controller.follow(req, res).catch(next);
  });
  router.delete("/:userId/follow", authenticate, (req, res, next) => {
    void controller.unfollow(req, res).catch(next);
  });
  router.post("/:userId/wave", authenticate, (req, res, next) => {
    void controller.wave(req, res).catch(next);
  });

  return router;
}

export function createMeSocialRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createSocialControllers(deps);

  router.get("/following", authenticate, (req, res, next) => {
    void controller.listFollowing(req, res).catch(next);
  });
  router.get("/followers", authenticate, (req, res, next) => {
    void controller.listFollowers(req, res).catch(next);
  });
  router.get("/waves", authenticate, (req, res, next) => {
    void controller.listWaves(req, res).catch(next);
  });
  router.post("/message-requests", authenticate, (req, res, next) => {
    void controller.createMessageRequest(req, res).catch(next);
  });
  router.get("/message-requests", authenticate, (req, res, next) => {
    void controller.listMessageRequests(req, res).catch(next);
  });
  router.post("/message-requests/:requestId/accept", authenticate, (req, res, next) => {
    void controller.acceptMessageRequest(req, res).catch(next);
  });
  router.post("/message-requests/:requestId/decline", authenticate, (req, res, next) => {
    void controller.declineMessageRequest(req, res).catch(next);
  });
  router.get("/messaging/summary", authenticate, (req, res, next) => {
    void controller.getMessagingSummary(req, res).catch(next);
  });
  router.get("/conversations", authenticate, (req, res, next) => {
    void controller.listConversations(req, res).catch(next);
  });
  router.get("/conversations/:conversationId/messages", authenticate, (req, res, next) => {
    void controller.listMessages(req, res).catch(next);
  });
  router.post("/conversations/:conversationId/messages", authenticate, (req, res, next) => {
    void controller.sendMessage(req, res).catch(next);
  });
  router.post("/conversations/:conversationId/read", authenticate, (req, res, next) => {
    void controller.markRead(req, res).catch(next);
  });

  return router;
}
