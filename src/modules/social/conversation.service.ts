import { Prisma, type User } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { toPolicyActor } from "../policy/account-policy.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import {
  decodeSocialCreatedCursor,
  decodeSocialUpdatedCursor,
  encodeSocialCreatedCursor,
  encodeSocialUpdatedCursor,
} from "./social-cursor.js";
import { assertFullAccess, socialNotFound } from "./social-access.js";
import {
  canAccessAcceptedConversation,
  isMessageAfterWatermark,
  otherParticipantId,
  shouldAdvanceReadWatermark,
  truncatePreview,
} from "./social-policy.js";
import {
  SOCIAL_LIST_DEFAULT_LIMIT,
  SOCIAL_LIST_MAX_LIMIT,
  SOCIAL_PREVIEW_MAX,
} from "./social.constants.js";
import {
  toSocialUserPreview,
  type ConversationSummaryDto,
  type DirectMessageDto,
} from "./social.dto.js";
import type {
  ConversationListQuery,
  ConversationMessagesQuery,
  MarkConversationReadInput,
  SendDirectMessageInput,
} from "./social.validation.js";
import { NotificationEmitter } from "../notifications/notification-emitter.service.js";

const counterpartSelect = {
  id: true,
  accountStatus: true,
  emailVerifiedAt: true,
  ageEligibilityStatus: true,
  suspendedAt: true,
  deletedAt: true,
  identityVerificationStatus: true,
  profile: {
    select: {
      displayName: true,
      username: true,
      avatarStorageKey: true,
      locationCity: true,
      locationRegion: true,
      profileVisibility: true,
    },
  },
} as const;

export class ConversationService {
  private readonly notifications: NotificationEmitter;

  constructor(
    private readonly db: DatabaseClient,
    notifications?: NotificationEmitter,
  ) {
    this.notifications = notifications ?? new NotificationEmitter(db);
  }

  async list(
    viewer: User,
    query: ConversationListQuery,
  ): Promise<{
    conversations: ConversationSummaryDto[];
    nextCursor: string | null;
  }> {
    assertFullAccess(viewer);
    const limit = Math.min(query.limit ?? SOCIAL_LIST_DEFAULT_LIMIT, SOCIAL_LIST_MAX_LIMIT);
    let cursor: { updatedAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeSocialUpdatedCursor(query.cursor);
      cursor = { updatedAt: new Date(decoded.updatedAt), id: decoded.id };
    }

    const rows = await this.db.directConversation.findMany({
      where: {
        participants: { some: { userId: viewer.id } },
        ...(cursor
          ? {
              OR: [
                { updatedAt: { lt: cursor.updatedAt } },
                { AND: [{ updatedAt: cursor.updatedAt }, { id: { lt: cursor.id } }] },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        participantLow: { select: counterpartSelect },
        participantHigh: { select: counterpartSelect },
        participants: true,
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
        },
      },
    });

    const page = rows.slice(0, limit);
    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const conversations: ConversationSummaryDto[] = [];

    for (const row of page) {
      const otherId = otherParticipantId(row.participantLowId, row.participantHighId, viewer.id);
      const blocked = await isBlockedEitherDirection(this.db, viewer.id, otherId);
      if (blocked || !canAccessAcceptedConversation(toPolicyActor(viewer), blocked)) {
        continue;
      }
      const other = otherId === row.participantLowId ? row.participantLow : row.participantHigh;
      if (query.q) {
        const hay =
          `${other.profile?.displayName ?? ""} ${other.profile?.username ?? ""}`.toLowerCase();
        if (!hay.includes(query.q.toLowerCase())) {
          continue;
        }
      }
      const mine = row.participants.find((p) => p.userId === viewer.id);
      const watermark =
        mine?.lastReadMessageId && mine.lastReadAt
          ? { createdAt: mine.lastReadAt, id: mine.lastReadMessageId }
          : null;
      const unreadCount = await this.db.directMessage.count({
        where: {
          conversationId: row.id,
          authorId: { not: viewer.id },
          ...(watermark
            ? {
                OR: [
                  { createdAt: { gt: watermark.createdAt } },
                  { AND: [{ createdAt: watermark.createdAt }, { id: { gt: watermark.id } }] },
                ],
              }
            : {}),
        },
      });
      const last = row.messages[0];
      conversations.push({
        conversationId: row.id,
        counterpart: toSocialUserPreview(
          viewerSnapshot,
          toDiscoverUserSnapshot(other),
          other.profile,
          false,
        ),
        lastMessage: last
          ? {
              messageId: last.id,
              body: truncatePreview(last.body, SOCIAL_PREVIEW_MAX),
              createdAt: last.createdAt.toISOString(),
              authorUserId: last.authorId,
            }
          : null,
        unreadCount,
        updatedAt: row.updatedAt.toISOString(),
      });
    }

    const lastRow = page[page.length - 1];
    const nextCursor =
      rows.length > limit && lastRow
        ? encodeSocialUpdatedCursor({
            updatedAt: lastRow.updatedAt.toISOString(),
            id: lastRow.id,
          })
        : null;

    return { conversations, nextCursor };
  }

  async listMessages(
    viewer: User,
    conversationId: string,
    query: ConversationMessagesQuery,
  ): Promise<{ messages: DirectMessageDto[]; nextCursor: string | null }> {
    const conversation = await this.requireAccessibleConversation(viewer, conversationId);
    const limit = Math.min(query.limit ?? SOCIAL_LIST_DEFAULT_LIMIT, SOCIAL_LIST_MAX_LIMIT);
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeSocialCreatedCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const rows = await this.db.directMessage.findMany({
      where: {
        conversationId: conversation.id,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }] },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const page = rows.slice(0, limit).reverse();
    const lastFetched = rows[Math.min(rows.length, limit) - 1];
    const nextCursor =
      rows.length > limit && lastFetched
        ? encodeSocialCreatedCursor({
            createdAt: lastFetched.createdAt.toISOString(),
            id: lastFetched.id,
          })
        : null;

    return {
      messages: page.map((row) => ({
        messageId: row.id,
        conversationId: row.conversationId,
        authorUserId: row.authorId,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async sendMessage(
    viewer: User,
    conversationId: string,
    input: SendDirectMessageInput,
  ): Promise<DirectMessageDto> {
    await this.requireAccessibleConversation(viewer, conversationId);
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT 1 FROM "DirectConversation" WHERE "id" = ${conversationId} FOR UPDATE`;
        const conversation = await tx.directConversation.findUnique({
          where: { id: conversationId },
        });
        if (!conversation) {
          throw socialNotFound();
        }
        const otherId = otherParticipantId(
          conversation.participantLowId,
          conversation.participantHighId,
          viewer.id,
        );
        const blocked = await isBlockedEitherDirection(tx, viewer.id, otherId);
        if (!canAccessAcceptedConversation(toPolicyActor(viewer), blocked)) {
          throw socialNotFound();
        }

        const created = await tx.directMessage.create({
          data: {
            conversationId,
            authorId: viewer.id,
            body: input.body,
            clientMessageId: input.clientMessageId ?? null,
          },
        });
        await tx.directConversation.update({
          where: { id: conversationId },
          data: {
            lastMessageId: created.id,
            lastMessageAt: created.createdAt,
            updatedAt: created.createdAt,
          },
        });

        await this.notifications.emitInTransaction(tx, {
          recipientId: otherId,
          type: "DIRECT_MESSAGE_RECEIVED",
          actorUserId: viewer.id,
          sourceId: conversationId,
          title: "New message",
          body: truncatePreview(input.body, SOCIAL_PREVIEW_MAX),
          dedupeKey: `direct-message:${conversationId}:${otherId}`,
        });

        return {
          messageId: created.id,
          conversationId: created.conversationId,
          authorUserId: created.authorId,
          body: created.body,
          createdAt: created.createdAt.toISOString(),
        };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        if (!input.clientMessageId) {
          throw err;
        }
        const existing = await this.db.directMessage.findFirst({
          where: {
            conversationId,
            authorId: viewer.id,
            clientMessageId: input.clientMessageId,
          },
        });
        if (existing) {
          return {
            messageId: existing.id,
            conversationId: existing.conversationId,
            authorUserId: existing.authorId,
            body: existing.body,
            createdAt: existing.createdAt.toISOString(),
          };
        }
      }
      throw err;
    }
  }

  async markRead(
    viewer: User,
    conversationId: string,
    input: MarkConversationReadInput,
  ): Promise<{ unreadCount: number }> {
    const conversation = await this.requireAccessibleConversation(viewer, conversationId);
    const target = input.messageId
      ? await this.db.directMessage.findUnique({
          where: { id: input.messageId },
          select: { id: true, conversationId: true, createdAt: true },
        })
      : await this.db.directMessage.findFirst({
          where: { conversationId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, conversationId: true, createdAt: true },
        });

    if (!target || target.conversationId !== conversationId) {
      if (input.messageId) {
        throw socialNotFound();
      }
      return { unreadCount: 0 };
    }

    const mine = await this.db.directConversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: viewer.id } },
    });
    const current =
      mine?.lastReadMessageId && mine.lastReadAt
        ? { createdAt: mine.lastReadAt, id: mine.lastReadMessageId }
        : null;

    if (shouldAdvanceReadWatermark(current, { createdAt: target.createdAt, id: target.id })) {
      await this.db.directConversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: viewer.id } },
        data: { lastReadMessageId: target.id, lastReadAt: target.createdAt },
      });
    }

    const otherId = otherParticipantId(
      conversation.participantLowId,
      conversation.participantHighId,
      viewer.id,
    );
    const unreadCount = await this.db.directMessage.count({
      where: {
        conversationId,
        authorId: otherId,
        OR: [
          { createdAt: { gt: target.createdAt } },
          { AND: [{ createdAt: target.createdAt }, { id: { gt: target.id } }] },
        ],
      },
    });
    return { unreadCount };
  }

  private async requireAccessibleConversation(viewer: User, conversationId: string) {
    assertFullAccess(viewer);
    const conversation = await this.db.directConversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });
    if (!conversation || !conversation.participants.some((p) => p.userId === viewer.id)) {
      throw socialNotFound();
    }
    const otherId = otherParticipantId(
      conversation.participantLowId,
      conversation.participantHighId,
      viewer.id,
    );
    const blocked = await isBlockedEitherDirection(this.db, viewer.id, otherId);
    if (!canAccessAcceptedConversation(toPolicyActor(viewer), blocked)) {
      throw socialNotFound();
    }
    return conversation;
  }
}

export function messageIsUnreadForTests(
  message: { createdAt: Date; id: string; authorId: string },
  viewerId: string,
  watermark: { createdAt: Date; id: string } | null,
): boolean {
  if (message.authorId === viewerId) {
    return false;
  }
  return isMessageAfterWatermark(message, watermark);
}
