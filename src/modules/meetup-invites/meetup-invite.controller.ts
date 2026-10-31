import type { Response } from "express";
import type { AppEnv } from "../../config/env.js";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { buildKycEnforcementContext } from "../verification/kyc-identity-authority.js";
import { MEETUP_INVITE_IDEMPOTENCY_HEADER } from "./meetup-invite.constants.js";
import { MeetupInviteService } from "./meetup-invite.service.js";
import {
  createMeetupInviteBodySchema,
  meetupInviteIdParamSchema,
  meetupInviteListQuerySchema,
} from "./meetup-invite.validation.js";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createMeetupInviteController(deps: { db: DatabaseClient; env: AppEnv }) {
  const kyc = buildKycEnforcementContext(deps.env);
  const service = new MeetupInviteService(deps.db, kyc);

  return {
    create: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      const body = createMeetupInviteBodySchema.parse(req.body);
      const idempotencyKey = req.header(MEETUP_INVITE_IDEMPOTENCY_HEADER)?.trim();
      const { dto, created } = await service.create(user, body, idempotencyKey);
      res.status(created ? 201 : 200).json({ data: dto, meta: { requestId: req.requestId } });
    },

    list: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      const query = meetupInviteListQuerySchema.parse(req.query);
      const data = await service.list(user, query);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    getById: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      const { inviteId } = meetupInviteIdParamSchema.parse(req.params);
      const data = await service.getById(user, inviteId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    accept: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      const { inviteId } = meetupInviteIdParamSchema.parse(req.params);
      const data = await service.accept(user, inviteId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    decline: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      const { inviteId } = meetupInviteIdParamSchema.parse(req.params);
      const data = await service.decline(user, inviteId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    withdraw: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      const { inviteId } = meetupInviteIdParamSchema.parse(req.params);
      const data = await service.withdraw(user, inviteId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
