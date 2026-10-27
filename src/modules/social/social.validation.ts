import { z } from "zod";
import {
  SOCIAL_LIST_MAX_LIMIT,
  SOCIAL_MESSAGE_BODY_MAX,
  SOCIAL_SEARCH_Q_MAX,
} from "./social.constants.js";

export const socialUserIdParamSchema = z.object({
  userId: z.string().uuid(),
});

export const socialRequestIdParamSchema = z.object({
  requestId: z.string().uuid(),
});

export const socialConversationIdParamSchema = z.object({
  conversationId: z.string().uuid(),
});

export const socialListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(SOCIAL_LIST_MAX_LIMIT).optional(),
    cursor: z.string().min(1).optional(),
  })
  .strict();

export const messageRequestListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(SOCIAL_LIST_MAX_LIMIT).optional(),
    cursor: z.string().min(1).optional(),
    box: z.enum(["inbox", "sent"]).optional(),
    status: z.enum(["PENDING", "ACCEPTED", "DECLINED"]).optional(),
  })
  .strict();

export const conversationListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(SOCIAL_LIST_MAX_LIMIT).optional(),
    cursor: z.string().min(1).optional(),
    q: z.string().trim().min(1).max(SOCIAL_SEARCH_Q_MAX).optional(),
  })
  .strict();

export const conversationMessagesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(SOCIAL_LIST_MAX_LIMIT).optional(),
    cursor: z.string().min(1).optional(),
  })
  .strict();

export const createMessageRequestBodySchema = z
  .object({
    targetUserId: z.string().uuid(),
  })
  .strict();

export const sendDirectMessageBodySchema = z
  .object({
    body: z.string().trim().min(1).max(SOCIAL_MESSAGE_BODY_MAX),
    clientMessageId: z.string().uuid().optional(),
  })
  .strict();

export const markConversationReadBodySchema = z
  .object({
    messageId: z.string().uuid().optional(),
  })
  .strict();

export type SocialListQuery = z.infer<typeof socialListQuerySchema>;
export type MessageRequestListQuery = z.infer<typeof messageRequestListQuerySchema>;
export type ConversationListQuery = z.infer<typeof conversationListQuerySchema>;
export type ConversationMessagesQuery = z.infer<typeof conversationMessagesQuerySchema>;
export type CreateMessageRequestInput = z.infer<typeof createMessageRequestBodySchema>;
export type SendDirectMessageInput = z.infer<typeof sendDirectMessageBodySchema>;
export type MarkConversationReadInput = z.infer<typeof markConversationReadBodySchema>;
