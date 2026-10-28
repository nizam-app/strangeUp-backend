import { Prisma, type User } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import {
  isMessageAfterWatermark,
  shouldAdvanceReadWatermark,
  truncatePreview,
} from "../social/social-policy.js";
import { decodeGroupCreatedCursor, encodeGroupCreatedCursor } from "./group-cursor.js";
import { groupForbidden, groupNotFound } from "./group-errors.js";
import { assertGroupAccess, loadMembership, requireActiveMember } from "./group-access.js";
import {
  GROUP_LIST_DEFAULT_LIMIT,
  GROUP_LIST_MAX_LIMIT,
  GROUP_PREVIEW_MAX,
} from "./group.constants.js";
import type { GroupChatSummaryDto, GroupMessageDto } from "./group.dto.js";
import type {
  GroupChatListQuery,
  GroupCursorListQuery,
  MarkGroupChatReadInput,
  SendGroupMessageInput,
} from "./group.validation.js";
import {
  publishGroupMessageSafe,
  publishGroupReadSafe,
} from "../messaging-realtime/messaging-realtime.publish.js";

export class GroupChatService {
  constructor(private readonly db: DatabaseClient) {}

  async listChats(
    viewer: User,
    query: GroupChatListQuery,
  ): Promise<{ chats: GroupChatSummaryDto[]; nextCursor: string | null }> {
    assertGroupAccess(viewer);
    const limit = Math.min(query.limit ?? GROUP_LIST_DEFAULT_LIMIT, GROUP_LIST_MAX_LIMIT);
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeGroupCreatedCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const memberships = await this.db.communityMembership.findMany({
      where: {
        userId: viewer.id,
        status: "ACTIVE",
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
      include: {
        group: {
          select: {
            id: true,
            name: true,
            coverStorageKey: true,
            updatedAt: true,
            messages: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 1,
            },
          },
        },
      },
    });

    const page = memberships.slice(0, limit);
    const chats: GroupChatSummaryDto[] = [];
    for (const row of page) {
      if (query.q && !row.group.name.toLowerCase().includes(query.q.toLowerCase())) {
        continue;
      }
      const last = row.group.messages[0] ?? null;
      const readState = await this.db.communityGroupReadState.findUnique({
        where: { groupId_userId: { groupId: row.groupId, userId: viewer.id } },
      });
      const watermark =
        readState?.lastReadMessageId && readState.lastReadAt
          ? { id: readState.lastReadMessageId, createdAt: readState.lastReadAt }
          : null;
      const unreadCount = await this.countUnread(row.groupId, viewer.id, watermark);
      chats.push({
        groupId: row.groupId,
        name: row.group.name,
        hasCover: row.group.coverStorageKey !== null,
        lastMessage: last
          ? {
              messageId: last.id,
              body: truncatePreview(last.body, GROUP_PREVIEW_MAX),
              createdAt: last.createdAt.toISOString(),
              authorUserId: last.authorId,
            }
          : null,
        unreadCount,
        updatedAt: (last?.createdAt ?? row.group.updatedAt).toISOString(),
      });
    }
    const last = page[page.length - 1];
    return {
      chats,
      nextCursor:
        memberships.length > limit && last
          ? encodeGroupCreatedCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  /** Task 023A — aggregate unread across all ACTIVE member group chats. */
  async summarizeUnread(
    viewer: User,
  ): Promise<{ unreadMessages: number; groupChatsWithUnread: number }> {
    assertGroupAccess(viewer);
    const memberships = await this.db.communityMembership.findMany({
      where: { userId: viewer.id, status: "ACTIVE" },
      select: { groupId: true },
    });
    if (memberships.length === 0) {
      return { unreadMessages: 0, groupChatsWithUnread: 0 };
    }

    const groupIds = memberships.map((m) => m.groupId);
    const readStates = await this.db.communityGroupReadState.findMany({
      where: { userId: viewer.id, groupId: { in: groupIds } },
      select: { groupId: true, lastReadMessageId: true, lastReadAt: true },
    });
    const readByGroup = new Map(readStates.map((state) => [state.groupId, state]));

    let unreadMessages = 0;
    let groupChatsWithUnread = 0;

    for (const { groupId } of memberships) {
      const readState = readByGroup.get(groupId);
      const watermark =
        readState?.lastReadMessageId && readState.lastReadAt
          ? { id: readState.lastReadMessageId, createdAt: readState.lastReadAt }
          : null;
      const count = await this.countUnread(groupId, viewer.id, watermark);
      if (count > 0) {
        groupChatsWithUnread += 1;
      }
      unreadMessages += count;
    }

    return { unreadMessages, groupChatsWithUnread };
  }

  async listMessages(
    viewer: User,
    groupId: string,
    query: GroupCursorListQuery,
  ): Promise<{ messages: GroupMessageDto[]; nextCursor: string | null }> {
    assertGroupAccess(viewer);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));

    const limit = Math.min(query.limit ?? GROUP_LIST_DEFAULT_LIMIT, GROUP_LIST_MAX_LIMIT);
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeGroupCreatedCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const rows = await this.db.communityGroupMessage.findMany({
      where: {
        groupId,
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

    const page = rows.slice(0, limit);
    const visible: GroupMessageDto[] = [];
    for (const row of page) {
      if (
        row.authorId !== viewer.id &&
        (await isBlockedEitherDirection(this.db, viewer.id, row.authorId))
      ) {
        continue;
      }
      visible.push({
        messageId: row.id,
        groupId: row.groupId,
        authorUserId: row.authorId,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
      });
    }
    visible.reverse();
    const last = page[page.length - 1];
    return {
      messages: visible,
      nextCursor:
        rows.length > limit && last
          ? encodeGroupCreatedCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  async sendMessage(
    viewer: User,
    groupId: string,
    input: SendGroupMessageInput,
  ): Promise<GroupMessageDto> {
    assertGroupAccess(viewer);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));
    const group = await this.db.communityGroup.findUnique({
      where: { id: groupId },
      select: { status: true },
    });
    if (!group || group.status !== "ACTIVE") {
      throw groupForbidden("This group is not accepting messages");
    }

    if (input.clientMessageId) {
      const existing = await this.db.communityGroupMessage.findUnique({
        where: {
          groupId_authorId_clientMessageId: {
            groupId,
            authorId: viewer.id,
            clientMessageId: input.clientMessageId,
          },
        },
      });
      if (existing) {
        const dto = {
          messageId: existing.id,
          groupId: existing.groupId,
          authorUserId: existing.authorId,
          body: existing.body,
          createdAt: existing.createdAt.toISOString(),
        };
        publishGroupMessageSafe({
          groupId,
          message: dto,
          clientMessageId: input.clientMessageId ?? null,
          newlyPersisted: false,
        });
        return dto;
      }
    }

    try {
      const row = await this.db.communityGroupMessage.create({
        data: {
          groupId,
          authorId: viewer.id,
          body: input.body,
          clientMessageId: input.clientMessageId ?? null,
        },
      });
      const dto = {
        messageId: row.id,
        groupId: row.groupId,
        authorUserId: row.authorId,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
      };
      publishGroupMessageSafe({
        groupId,
        message: dto,
        clientMessageId: input.clientMessageId ?? null,
        newlyPersisted: true,
      });
      return dto;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        input.clientMessageId
      ) {
        const existing = await this.db.communityGroupMessage.findUnique({
          where: {
            groupId_authorId_clientMessageId: {
              groupId,
              authorId: viewer.id,
              clientMessageId: input.clientMessageId,
            },
          },
        });
        if (existing) {
          const dto = {
            messageId: existing.id,
            groupId: existing.groupId,
            authorUserId: existing.authorId,
            body: existing.body,
            createdAt: existing.createdAt.toISOString(),
          };
          publishGroupMessageSafe({
            groupId,
            message: dto,
            clientMessageId: input.clientMessageId ?? null,
            newlyPersisted: false,
          });
          return dto;
        }
      }
      throw err;
    }
  }

  async markRead(
    viewer: User,
    groupId: string,
    input: MarkGroupChatReadInput,
  ): Promise<{ unreadCount: number }> {
    assertGroupAccess(viewer);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));

    let next: { id: string; createdAt: Date } | null;
    if (input.messageId) {
      const target = await this.db.communityGroupMessage.findUnique({
        where: { id: input.messageId },
        select: { id: true, groupId: true, createdAt: true },
      });
      if (!target || target.groupId !== groupId) {
        throw groupNotFound();
      }
      next = { id: target.id, createdAt: target.createdAt };
    } else {
      const latest = await this.db.communityGroupMessage.findFirst({
        where: { groupId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, createdAt: true },
      });
      next = latest ? { id: latest.id, createdAt: latest.createdAt } : null;
    }

    const current = await this.db.communityGroupReadState.findUnique({
      where: { groupId_userId: { groupId, userId: viewer.id } },
    });
    const currentPointer =
      current?.lastReadMessageId && current.lastReadAt
        ? { id: current.lastReadMessageId, createdAt: current.lastReadAt }
        : null;

    if (next && shouldAdvanceReadWatermark(currentPointer, next)) {
      await this.db.communityGroupReadState.upsert({
        where: { groupId_userId: { groupId, userId: viewer.id } },
        create: {
          groupId,
          userId: viewer.id,
          lastReadMessageId: next.id,
          lastReadAt: next.createdAt,
        },
        update: {
          lastReadMessageId: next.id,
          lastReadAt: next.createdAt,
        },
      });
    }

    const watermark =
      next && shouldAdvanceReadWatermark(currentPointer, next) ? next : currentPointer;
    const unreadCount = await this.countUnread(groupId, viewer.id, watermark);
    publishGroupReadSafe({
      groupId,
      readerUserId: viewer.id,
      unreadCount,
    });
    return { unreadCount };
  }

  private async countUnread(
    groupId: string,
    viewerId: string,
    watermark: { id: string; createdAt: Date } | null,
  ): Promise<number> {
    const recent = await this.db.communityGroupMessage.findMany({
      where: {
        groupId,
        authorId: { not: viewerId },
      },
      select: { id: true, createdAt: true, authorId: true },
    });
    let count = 0;
    for (const message of recent) {
      if (!isMessageAfterWatermark(message, watermark)) {
        continue;
      }
      if (await isBlockedEitherDirection(this.db, viewerId, message.authorId)) {
        continue;
      }
      count += 1;
    }
    return count;
  }
}
