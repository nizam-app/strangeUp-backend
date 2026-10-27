import { Router } from "express";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAuthenticateMiddleware } from "../../common/middleware/authenticate.js";
import type { AuthService } from "../auth/auth.service.js";
import { createJobsController } from "./job.controller.js";

export function createJobsRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createJobsController(deps);

  router.get("/", authenticate, (req, res, next) => {
    void controller.listJobs(req, res).catch(next);
  });
  router.get("/:jobId", authenticate, (req, res, next) => {
    void controller.getJob(req, res).catch(next);
  });
  router.post("/:jobId/applications", authenticate, (req, res, next) => {
    void controller.submitApplication(req, res).catch(next);
  });

  return router;
}

export function createMeJobsRouter(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}): Router {
  const router = Router();
  const authenticate = createAuthenticateMiddleware(deps.authService);
  const controller = createJobsController(deps);

  router.get("/saved-jobs", authenticate, (req, res, next) => {
    void controller.listSavedJobs(req, res).catch(next);
  });
  router.put("/saved-jobs/:jobId", authenticate, (req, res, next) => {
    void controller.saveJob(req, res).catch(next);
  });
  router.delete("/saved-jobs/:jobId", authenticate, (req, res, next) => {
    void controller.unsaveJob(req, res).catch(next);
  });

  router.get("/job-applications", authenticate, (req, res, next) => {
    void controller.listMyApplications(req, res).catch(next);
  });
  router.get("/job-applications/:applicationId", authenticate, (req, res, next) => {
    void controller.getMyApplication(req, res).catch(next);
  });

  router.post("/job-listings", authenticate, (req, res, next) => {
    void controller.createDraft(req, res).catch(next);
  });
  router.get("/job-listings", authenticate, (req, res, next) => {
    void controller.listDrafts(req, res).catch(next);
  });
  router.get("/job-listings/:jobId", authenticate, (req, res, next) => {
    void controller.getDraft(req, res).catch(next);
  });
  router.patch("/job-listings/:jobId", authenticate, (req, res, next) => {
    void controller.patchDraft(req, res).catch(next);
  });

  return router;
}
