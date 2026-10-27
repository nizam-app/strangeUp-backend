import type { Response } from "express";
import type { AppEnv } from "../../config/env.js";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { JobApplicationService } from "./job-application.service.js";
import { JobDraftService } from "./job-draft.service.js";
import { JobSaveService } from "./job-save.service.js";
import { JobDiscoveryService } from "./job.service.js";
import {
  createJobDraftBodySchema,
  jobApplicationIdParamSchema,
  jobIdParamSchema,
  jobListQuerySchema,
  patchJobDraftBodySchema,
  submitJobApplicationBodySchema,
} from "./job.validation.js";
import { JOB_LIST_DEFAULT_LIMIT, JOB_LIST_MAX_LIMIT } from "./job.constants.js";
import { z } from "zod";
import { buildConsentRegistryContext } from "../consent/consent-context.js";
import { validateJobApplicationConsentVersion } from "../consent/canonical-consent-registry.js";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

const jobApplicationListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(JOB_LIST_MAX_LIMIT).default(JOB_LIST_DEFAULT_LIMIT),
});

export function createJobsController(deps: { db: DatabaseClient; env: AppEnv }) {
  const discovery = new JobDiscoveryService(deps.db);
  const saves = new JobSaveService(deps.db);
  const applications = new JobApplicationService(deps.db);
  const drafts = new JobDraftService(deps.db);

  return {
    listJobs: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = jobListQuerySchema.parse(req.query);
      const result = await discovery.listJobs(requireUser(req), query);
      res.status(200).json({
        data: { jobs: result.jobs },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    getJob: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { jobId } = jobIdParamSchema.parse(req.params);
      const data = await discovery.getJob(requireUser(req), jobId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listSavedJobs: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await saves.listSaved(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    saveJob: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { jobId } = jobIdParamSchema.parse(req.params);
      const data = await saves.saveJob(requireUser(req), jobId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    unsaveJob: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { jobId } = jobIdParamSchema.parse(req.params);
      const data = await saves.unsaveJob(requireUser(req), jobId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    submitApplication: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { jobId } = jobIdParamSchema.parse(req.params);
      const body = submitJobApplicationBodySchema.parse(req.body);
      const consentCtx = buildConsentRegistryContext(deps.env);
      const consentCheck = validateJobApplicationConsentVersion(
        body.applicationConsentVersion,
        consentCtx,
      );
      if (!consentCheck.ok) {
        const status = consentCheck.code === "CONSENT_VERSION_UNAVAILABLE" ? 503 : 400;
        throw new AppError(
          consentCheck.code === "CONSENT_VERSION_UNAVAILABLE"
            ? "SERVICE_UNAVAILABLE"
            : "VALIDATION_ERROR",
          consentCheck.message,
          status,
        );
      }
      const data = await applications.submit(requireUser(req), jobId, body);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },

    listMyApplications: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = jobApplicationListQuerySchema.parse(req.query);
      const result = await applications.listMine(requireUser(req), query);
      res.status(200).json({
        data: { applications: result.applications },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    getMyApplication: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { applicationId } = jobApplicationIdParamSchema.parse(req.params);
      const data = await applications.getMine(requireUser(req), applicationId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    createDraft: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const body = createJobDraftBodySchema.parse(req.body);
      const data = await drafts.createDraft(requireUser(req), body);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },

    listDrafts: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await drafts.listDrafts(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    getDraft: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { jobId } = jobIdParamSchema.parse(req.params);
      const data = await drafts.getDraft(requireUser(req), jobId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    patchDraft: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { jobId } = jobIdParamSchema.parse(req.params);
      const body = patchJobDraftBodySchema.parse(req.body);
      const data = await drafts.patchDraft(requireUser(req), jobId, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
