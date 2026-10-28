import { randomUUID } from "node:crypto";
import type { Prisma, UserNotificationType } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { NOTIFICATION_DM_AGGREGATE_WINDOW_MS } from "./notification.constants.js";
import { enqueuePushOutboxForNotification } from "../push-delivery/push-outbox-enqueue.js";

type DbLike = DatabaseClient | Prisma.TransactionClient;

export type EmitNotificationInput = {
  recipientId: string;
  type: UserNotificationType;
  actorUserId?: string | null;
  sourceId?: string | null;
  title: string;
  body: string;
  dedupeKey?: string | null;
};

export class NotificationEmitter {
  constructor(private readonly db: DatabaseClient) {}

  async emit(input: EmitNotificationInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client: DbLike = tx ?? this.db;
    const selfScoped =
      input.type === "ACTIVITY_RSVP_CONFIRMED" ||
      input.type === "ACTIVITY_RSVP_WAITLISTED" ||
      input.type === "ACTIVITY_WAITLIST_PROMOTED";
    if (input.recipientId === input.actorUserId && !selfScoped) {
      return;
    }

    if (input.dedupeKey) {
      const existing = await client.userNotification.findUnique({
        where: { dedupeKey: input.dedupeKey },
        select: { id: true, readAt: true, createdAt: true, type: true },
      });
      if (existing) {
        if (
          existing.type === "DIRECT_MESSAGE_RECEIVED" &&
          existing.readAt === null &&
          Date.now() - existing.createdAt.getTime() < NOTIFICATION_DM_AGGREGATE_WINDOW_MS
        ) {
          await client.userNotification.update({
            where: { id: existing.id },
            data: {
              title: input.title,
              body: input.body,
              actorUserId: input.actorUserId ?? null,
              updatedAt: new Date(),
            },
          });
          return;
        }
        return;
      }
    }

    const notificationId = randomUUID();
    await client.userNotification.create({
      data: {
        id: notificationId,
        recipientId: input.recipientId,
        type: input.type,
        actorUserId: input.actorUserId ?? null,
        sourceId: input.sourceId ?? null,
        title: input.title,
        body: input.body,
        dedupeKey: input.dedupeKey ?? null,
      },
    });
    await enqueuePushOutboxForNotification(client, {
      userNotificationId: notificationId,
      recipientId: input.recipientId,
    });
  }

  async emitInTransaction(
    tx: Prisma.TransactionClient,
    input: EmitNotificationInput,
  ): Promise<void> {
    await this.emit(input, tx);
  }
}
