import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { assertFullAccess } from "../social/social-access.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { membershipUserSelect } from "../groups/group-access.js";
import { toGroupUserPreview } from "../groups/group.dto.js";
import {
  NOTIFICATION_LIST_DEFAULT_LIMIT,
  NOTIFICATION_LIST_MAX_LIMIT,
} from "./notification.constants.js";
import { decodeNotificationCursor, encodeNotificationCursor } from "./notification-cursor.js";
import type { NotificationDto } from "./notification.dto.js";
import type { NotificationListQuery } from "./notification.validation.js";

export class NotificationService {
  constructor(private readonly db: DatabaseClient) {}

  async countUnread(viewer: User): Promise<number> {
    assertFullAccess(viewer);
    return this.db.userNotification.count({
      where: { recipientId: viewer.id, readAt: null },
    });
  }

  async list(
    viewer: User,
    query: NotificationListQuery,
  ): Promise<{ notifications: NotificationDto[]; unreadCount: number; nextCursor: string | null }> {
    assertFullAccess(viewer);
    const limit = Math.min(
      query.limit ?? NOTIFICATION_LIST_DEFAULT_LIMIT,
      NOTIFICATION_LIST_MAX_LIMIT,
    );

    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeNotificationCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const rows = await this.db.userNotification.findMany({
      where: {
        recipientId: viewer.id,
        ...(query.unreadOnly ? { readAt: null } : {}),
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
    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const notifications: NotificationDto[] = [];
    for (const row of page) {
      notifications.push(await this.toDto(viewer, viewerSnapshot, row));
    }

    const unreadCount = await this.countUnread(viewer);
    const last = page[page.length - 1];
    return {
      notifications,
      unreadCount,
      nextCursor:
        rows.length > limit && last
          ? encodeNotificationCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  async markRead(viewer: User, notificationId: string): Promise<NotificationDto> {
    assertFullAccess(viewer);
    const row = await this.db.userNotification.findUnique({ where: { id: notificationId } });
    if (!row || row.recipientId !== viewer.id) {
      throw new AppError("NOT_FOUND", "Notification not found", 404);
    }
    if (row.readAt) {
      return this.toDto(viewer, toDiscoverUserSnapshot(viewer), row);
    }
    const updated = await this.db.userNotification.update({
      where: { id: row.id },
      data: { readAt: new Date() },
    });
    return this.toDto(viewer, toDiscoverUserSnapshot(viewer), updated);
  }

  async markAllRead(viewer: User): Promise<{ updatedCount: number }> {
    assertFullAccess(viewer);
    const now = new Date();
    const result = await this.db.userNotification.updateMany({
      where: { recipientId: viewer.id, readAt: null },
      data: { readAt: now },
    });
    return { updatedCount: result.count };
  }

  private async toDto(
    viewer: User,
    viewerSnapshot: ReturnType<typeof toDiscoverUserSnapshot>,
    row: {
      id: string;
      type: NotificationDto["type"];
      title: string;
      body: string;
      actorUserId: string | null;
      sourceId: string | null;
      readAt: Date | null;
      createdAt: Date;
    },
  ): Promise<NotificationDto> {
    let actor: NotificationDto["actor"] = null;
    if (row.actorUserId) {
      const blocked = await isBlockedEitherDirection(this.db, viewer.id, row.actorUserId);
      if (!blocked) {
        const actorUser = await this.db.user.findUnique({
          where: { id: row.actorUserId },
          select: membershipUserSelect,
        });
        if (actorUser?.profile) {
          actor = toGroupUserPreview(
            viewerSnapshot,
            toDiscoverUserSnapshot(actorUser),
            actorUser.profile,
            false,
          );
        }
      }
    }
    return {
      notificationId: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      actor,
      sourceId: row.sourceId,
      read: row.readAt !== null,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
