import type { GroupMessageDto } from "../groups/group.dto.js";
import type { DirectMessageDto, MessagingSummaryDto } from "../social/social.dto.js";

export type DirectMessagePublished = {
  conversationId: string;
  message: DirectMessageDto;
  clientMessageId?: string | null;
  /** When false, skip broadcast (idempotent REST replay). */
  newlyPersisted: boolean;
};

export type DirectReadPublished = {
  conversationId: string;
  readerUserId: string;
  unreadCount: number;
};

export type GroupMessagePublished = {
  groupId: string;
  message: GroupMessageDto;
  clientMessageId?: string | null;
  newlyPersisted: boolean;
};

export type GroupReadPublished = {
  groupId: string;
  readerUserId: string;
  unreadCount: number;
};

export interface MessagingRealtimeBus {
  publishDirectMessage(event: DirectMessagePublished): Promise<void>;
  publishDirectRead(event: DirectReadPublished): Promise<void>;
  publishGroupMessage(event: GroupMessagePublished): Promise<void>;
  publishGroupRead(event: GroupReadPublished): Promise<void>;
  publishSummary(userIds: string[], summary: MessagingSummaryDto): Promise<void>;
}

export const noopMessagingRealtimeBus: MessagingRealtimeBus = {
  async publishDirectMessage() {},
  async publishDirectRead() {},
  async publishGroupMessage() {},
  async publishGroupRead() {},
  async publishSummary() {},
};
