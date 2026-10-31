import type { Response } from "express";
import type { AppEnv } from "../../config/env.js";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { createAppMediaStorages } from "../../infrastructure/media-storage/create-media-storages.js";
import { ActivityHostJoinRequestsService } from "./activity-host-join-requests.service.js";
import { ActivityHostService } from "./activity-host.service.js";
import { ActivityRosterService } from "./activity-roster.service.js";
import { ActivityMyInventoryService } from "./activity-my-inventory.service.js";
import { ActivityRsvpService } from "./activity-rsvp.service.js";
import { ActivityService } from "./activity.service.js";
import { buildKycEnforcementContext } from "../verification/kyc-identity-authority.js";
import {
  activityIdParamSchema,
  activityListQuerySchema,
  activityRosterQuerySchema,
  createActivityBodySchema,
  hostActivityListQuerySchema,
  hostJoinRequestListQuerySchema,
  hostJoinRequestUserParamSchema,
  myActivityInventoryQuerySchema,
  myRsvpListQuerySchema,
  patchActivityBodySchema,
} from "./activity.validation.js";

export function createActivitiesControllers(deps: { db: DatabaseClient; env: AppEnv }) {
  const kyc = buildKycEnforcementContext(deps.env);
  const mediaStorages = createAppMediaStorages(deps.env);
  const activityService = new ActivityService(deps.db, mediaStorages.activityCover, kyc);
  const hostService = new ActivityHostService(deps.db, mediaStorages.activityCover, kyc);
  const rsvpService = new ActivityRsvpService(deps.db, kyc);
  const inventoryService = new ActivityMyInventoryService(deps.db);
  const joinRequestsService = new ActivityHostJoinRequestsService(deps.db, kyc);
  const rosterService = new ActivityRosterService(deps.db);

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

    listActivityParticipants: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = activityIdParamSchema.parse(req.params);
      const query = activityRosterQuerySchema.parse(req.query);
      const result = await rosterService.listConfirmedRoster(requireUser(req), activityId, query);
      res.status(200).json({
        data: {
          activityId: result.activityId,
          confirmedCount: result.confirmedCount,
          attendees: result.attendees,
        },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
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

    listMyActivityInventory: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = myActivityInventoryQuerySchema.parse(req.query);
      const result = await inventoryService.list(requireUser(req), query);
      res.status(200).json({
        data: {
          items: result.items,
          ...(result.counts ? { counts: result.counts } : {}),
        },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    listHostJoinRequests: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId } = activityIdParamSchema.parse(req.params);
      const query = hostJoinRequestListQuerySchema.parse(req.query);
      const result = await joinRequestsService.listPending(requireUser(req), activityId, query);
      res.status(200).json({
        data: { requests: result.requests },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    approveHostJoinRequest: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId, userId } = hostJoinRequestUserParamSchema.parse(req.params);
      const data = await joinRequestsService.approve(requireUser(req), activityId, userId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    declineHostJoinRequest: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { activityId, userId } = hostJoinRequestUserParamSchema.parse(req.params);
      const data = await joinRequestsService.decline(requireUser(req), activityId, userId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
