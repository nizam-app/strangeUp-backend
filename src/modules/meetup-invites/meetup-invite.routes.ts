import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AuthService } from "../auth/auth.service.js";
import { createMeetupInviteController } from "./meetup-invite.controller.js";

export function createMeetupInvitesRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const controller = createMeetupInviteController(deps);

  router.post("/", (req, res, next) => {
    void controller.create(req, res).catch(next);
  });

  router.get("/", (req, res, next) => {
    void controller.list(req, res).catch(next);
  });

  router.post("/:inviteId/accept", (req, res, next) => {
    void controller.accept(req, res).catch(next);
  });

  router.post("/:inviteId/decline", (req, res, next) => {
    void controller.decline(req, res).catch(next);
  });

  router.post("/:inviteId/withdraw", (req, res, next) => {
    void controller.withdraw(req, res).catch(next);
  });

  router.get("/:inviteId", (req, res, next) => {
    void controller.getById(req, res).catch(next);
  });

  return router;
}
