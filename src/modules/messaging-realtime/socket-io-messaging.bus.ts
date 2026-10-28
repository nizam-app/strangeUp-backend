import type { Server } from "socket.io";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isUserEligibleForMessagingSummary } from "./messaging-realtime.eligibility.js";
import { assertMainAppHomeAccess } from "../policy/home-access-enforcement.js";
import type { AppEnv } from "../../config/env.js";
import { MessagingSummaryService } from "../social/messaging-summary.service.js";
import { MESSAGING_SOCKET_EVENTS, userRoom } from "./messaging-realtime.constants.js";
import type {
  DirectMessagePublished,
  DirectReadPublished,
  GroupMessagePublished,
  GroupReadPublished,
  MessagingRealtimeBus,
} from "./messaging-realtime.bus.js";
import type { MessagingSummaryDto } from "../social/social.dto.js";
import {
  listAuthorizedDmMessageRecipients,
  listAuthorizedDmReadRecipients,
  listAuthorizedGroupMessageRecipients,
  listAuthorizedGroupReadRecipients,
} from "./messaging-realtime.recipients.js";

export class SocketIoMessagingBus implements MessagingRealtimeBus {
  private readonly summaryService: MessagingSummaryService;

  constructor(
    private readonly io: Server,
    private readonly db: DatabaseClient,
    private readonly env: AppEnv,
  ) {
    this.summaryService = new MessagingSummaryService(db);
  }

  async publishDirectMessage(event: DirectMessagePublished): Promise<void> {
    if (!event.newlyPersisted) {
      return;
    }
    const recipients = await listAuthorizedDmMessageRecipients(
      this.db,
      event.conversationId,
      event.message.authorUserId,
    );
    const payload = {
      eventId: event.message.messageId,
      message: event.message,
      clientMessageId: event.clientMessageId ?? null,
    };
    for (const userId of recipients) {
      this.io.to(userRoom(userId)).emit(MESSAGING_SOCKET_EVENTS.dmMessage, payload);
    }
    await this.emitSummariesForUsers(recipients);
  }

  async publishDirectRead(event: DirectReadPublished): Promise<void> {
    const recipients = await listAuthorizedDmReadRecipients(this.db, event.conversationId);
    const payload = {
      eventId: `${event.conversationId}:${event.readerUserId}:read`,
      conversationId: event.conversationId,
      readerUserId: event.readerUserId,
      unreadCount: event.unreadCount,
    };
    for (const userId of recipients) {
      this.io.to(userRoom(userId)).emit(MESSAGING_SOCKET_EVENTS.dmRead, payload);
    }
    await this.emitSummariesForUsers(recipients);
  }

  async publishGroupMessage(event: GroupMessagePublished): Promise<void> {
    if (!event.newlyPersisted) {
      return;
    }
    const recipients = await listAuthorizedGroupMessageRecipients(
      this.db,
      event.groupId,
      event.message.authorUserId,
    );
    const payload = {
      eventId: event.message.messageId,
      message: event.message,
      clientMessageId: event.clientMessageId ?? null,
    };
    for (const userId of recipients) {
      this.io.to(userRoom(userId)).emit(MESSAGING_SOCKET_EVENTS.groupMessage, payload);
    }
    await this.emitSummariesForUsers(recipients);
  }

  async publishGroupRead(event: GroupReadPublished): Promise<void> {
    const recipients = await listAuthorizedGroupReadRecipients(this.db, event.groupId);
    const payload = {
      eventId: `${event.groupId}:${event.readerUserId}:read`,
      readerUserId: event.readerUserId,
      groupId: event.groupId,
      unreadCount: event.unreadCount,
    };
    for (const userId of recipients) {
      this.io.to(userRoom(userId)).emit(MESSAGING_SOCKET_EVENTS.groupRead, payload);
    }
    await this.emitSummariesForUsers(recipients);
  }

  async publishSummary(userIds: string[], summary: MessagingSummaryDto): Promise<void> {
    for (const userId of userIds) {
      if (!(await isUserEligibleForMessagingSummary(this.db, this.env, userId))) {
        continue;
      }
      this.io.to(userRoom(userId)).emit(MESSAGING_SOCKET_EVENTS.summary, {
        eventId: `summary:${userId}:${summary.totalUnreadMessages}:${summary.messageRequestsPending}`,
        summary,
      });
    }
  }

  private async emitSummariesForUsers(userIds: string[]): Promise<void> {
    const unique = [...new Set(userIds)];
    for (const userId of unique) {
      try {
        const user = await assertMainAppHomeAccess(this.db, this.env, userId);
        const summary = await this.summaryService.getSummary(user);
        this.io.to(userRoom(userId)).emit(MESSAGING_SOCKET_EVENTS.summary, {
          eventId: `summary:${userId}:${summary.totalUnreadMessages}:${summary.messageRequestsPending}`,
          summary,
        });
      } catch {
        // ineligible recipient — do not emit summary
      }
    }
  }
}
