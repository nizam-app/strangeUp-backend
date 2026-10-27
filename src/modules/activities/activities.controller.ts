import type { Response } from "express";
import type { AppEnv } from "../../config/env.js";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { LocalActivityCoverStorage } from "./activity-cover.storage.js";
import { ActivityHostService } from "./activity-host.service.js";
import { ActivityRsvpService } from "./activity-rsvp.service.js";
import { ActivityService } from "./activity.service.js";
import {
  activityIdParamSchema,
  activityListQuerySchema,
  createActivityBodySchema,
  hostActivityListQuerySchema,
  myRsvpListQuerySchema,
  patchActivityBodySchema,
} from "./activity.validation.js";

export function createActivitiesControllers(deps: { db: DatabaseClient; env: AppEnv }) {
  const kyc = {
    isProduction: deps.env.isProduction,
    kycProviderEnabled: deps.env.KYC_PROVIDER_ENABLED,
  };
  const coverStorage = new LocalActivityCoverStorage(deps.env.ACTIVITY_UPLOAD_DIR);
  const activityService = new ActivityService(deps.db, coverStorage, kyc);
  const hostService = new ActivityHostService(deps.db, coverStorage, kyc);
  const rsvpService = new ActivityRsvpService(deps.db, kyc);

  function requireUser(req: AuthenticatedRequest) {
    if (!req.authUser) {
      throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
    }
    return req.authUser;
  }

  return {
    listCategories: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await activityService.listCategories(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listDiscoverable: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = activityListQuerySchema.parse(req.query);
      const result = await activityService.listDiscoverable(requireUser(req), query);
      res.status(200).json({
        data: { activities: result.activities },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    getPublicDetail: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = activityIdParamSchema.parse(req.params);
      const data = await activityService.getPublicDetail(requireUser(req), activityId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    getMeeting: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = activityIdParamSchema.parse(req.params);
      const data = await activityService.getMeeting(requireUser(req), activityId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    getPublicCover: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = activityIdParamSchema.parse(req.params);
      const { buffer, contentType } = await activityService.getPublicCoverBytes(
        requireUser(req),
        activityId,
      );
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).send(buffer);
    },

    rsvp: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = activityIdParamSchema.parse(req.params);
      const data = await rsvpService.rsvp(requireUser(req), activityId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    leave: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = activityIdParamSchema.parse(req.params);
      const data = await rsvpService.leave(requireUser(req), activityId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listMine: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = hostActivityListQuerySchema.parse(req.query);
      const result = await hostService.listMine(requireUser(req), query);
      res.status(200).json({
        data: { activities: result.activities },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    getMine: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = activityIdParamSchema.parse(req.params);
      const data = await hostService.getMine(requireUser(req), activityId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    createDraft: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const body = createActivityBodySchema.parse(req.body);
      const data = await hostService.createDraft(requireUser(req), body);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },

    patchMine: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = activityIdParamSchema.parse(req.params);
      const body = patchActivityBodySchema.parse(req.body);
      const data = await hostService.patchMine(requireUser(req), activityId, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    publishMine: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = activityIdParamSchema.parse(req.params);
      const data = await hostService.publishMine(requireUser(req), activityId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    cancelMine: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = activityIdParamSchema.parse(req.params);
      const data = await hostService.cancelMine(requireUser(req), activityId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    uploadCover: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = activityIdParamSchema.parse(req.params);
      if (!req.file) {
        throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
      }
      const data = await hostService.replaceCover(requireUser(req), activityId, req.file);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    getOwnCover: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = activityIdParamSchema.parse(req.params);
      const { buffer, contentType } = await hostService.getOwnCoverBytes(
        requireUser(req),
        activityId,
      );
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).send(buffer);
    },

    deleteCover: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = activityIdParamSchema.parse(req.params);
      const data = await hostService.deleteCover(requireUser(req), activityId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listMyRsvps: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = myRsvpListQuerySchema.parse(req.query);
      const result = await rsvpService.listMine(requireUser(req), query);
      res.status(200).json({
        data: { rsvps: result.rsvps },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },
  };
}
