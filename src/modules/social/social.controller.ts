import type { Response } from "express";
import type { AppEnv } from "../../config/env.js";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { checkRateLimit, throwIfRateLimited } from "../auth/rate-limit.js";
import { ConversationService } from "./conversation.service.js";
import { FollowService } from "./follow.service.js";
import { MessageRequestService } from "./message-request.service.js";
import { WaveService } from "./wave.service.js";
import {
  conversationListQuerySchema,
  conversationMessagesQuerySchema,
  createMessageRequestBodySchema,
  markConversationReadBodySchema,
  messageRequestListQuerySchema,
  sendDirectMessageBodySchema,
  socialConversationIdParamSchema,
  socialListQuerySchema,
  socialRequestIdParamSchema,
  socialUserIdParamSchema,
} from "./social.validation.js";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

async function enforceLimit(key: string, limit: number): Promise<void> {
  throwIfRateLimited(await checkRateLimit(key, limit, 60_000));
}

export function createSocialControllers(deps: { db: DatabaseClient; env: AppEnv }) {
  const followService = new FollowService(deps.db);
  const waveService = new WaveService(deps.db);
  const requestService = new MessageRequestService(deps.db);
  const conversationService = new ConversationService(deps.db);
  const followLimit = deps.env.SOCIAL_RATE_LIMIT_FOLLOW_PER_USER;
  const waveLimit = deps.env.SOCIAL_RATE_LIMIT_WAVE_PER_USER;
  const requestLimit = deps.env.SOCIAL_RATE_LIMIT_REQUEST_PER_USER;
  const messageLimit = deps.env.SOCIAL_RATE_LIMIT_MESSAGE_PER_USER;

  return {
    follow: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      const { userId } = socialUserIdParamSchema.parse(req.params);
      await enforceLimit(`social:follow:${user.id}`, followLimit);
      const data = await followService.follow(user, userId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    unfollow: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      const { userId } = socialUserIdParamSchema.parse(req.params);
      const data = await followService.unfollow(user, userId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listFollowing: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = socialListQuerySchema.parse(req.query);
      const result = await followService.listFollowing(requireUser(req), query);
      res.status(200).json({
        data: { people: result.people },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    listFollowers: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = socialListQuerySchema.parse(req.query);
      const result = await followService.listFollowers(requireUser(req), query);
      res.status(200).json({
        data: { people: result.people },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    wave: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      const { userId } = socialUserIdParamSchema.parse(req.params);
      await enforceLimit(`social:wave:${user.id}`, waveLimit);
      const data = await waveService.sendWave(user, userId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listWaves: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = socialListQuerySchema.parse(req.query);
      const result = await waveService.listIncoming(requireUser(req), query);
      res.status(200).json({
        data: { waves: result.waves },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    createMessageRequest: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      const body = createMessageRequestBodySchema.parse(req.body);
      await enforceLimit(`social:request:${user.id}`, requestLimit);
      const result = await requestService.create(user, body.targetUserId);
      res.status(result.created ? 201 : 200).json({
        data: result.dto,
        meta: { requestId: req.requestId },
      });
    },

    listMessageRequests: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = messageRequestListQuerySchema.parse(req.query);
      const result = await requestService.list(requireUser(req), query);
      res.status(200).json({
        data: { requests: result.requests },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    acceptMessageRequest: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { requestId } = socialRequestIdParamSchema.parse(req.params);
      const data = await requestService.accept(requireUser(req), requestId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    declineMessageRequest: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { requestId } = socialRequestIdParamSchema.parse(req.params);
      const data = await requestService.decline(requireUser(req), requestId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listConversations: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = conversationListQuerySchema.parse(req.query);
      const result = await conversationService.list(requireUser(req), query);
      res.status(200).json({
        data: { conversations: result.conversations },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    listMessages: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { conversationId } = socialConversationIdParamSchema.parse(req.params);
      const query = conversationMessagesQuerySchema.parse(req.query);
      const result = await conversationService.listMessages(
        requireUser(req),
        conversationId,
        query,
      );
      res.status(200).json({
        data: { messages: result.messages },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    sendMessage: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = requireUser(req);
      const { conversationId } = socialConversationIdParamSchema.parse(req.params);
      const body = sendDirectMessageBodySchema.parse(req.body);
      await enforceLimit(`social:message:${user.id}`, messageLimit);
      const data = await conversationService.sendMessage(user, conversationId, body);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },

    markRead: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { conversationId } = socialConversationIdParamSchema.parse(req.params);
      const body = markConversationReadBodySchema.parse(req.body ?? {});
      const data = await conversationService.markRead(requireUser(req), conversationId, body);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
