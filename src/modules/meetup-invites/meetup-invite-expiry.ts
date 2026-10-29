import { Prisma } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";

type DbLike = DatabaseClient | Prisma.TransactionClient;

/** Persist lazy EXPIRED for overdue PENDING rows (D-28; no background worker). */
export async function reconcileLazyExpiredMeetupInvitesForUser(
  db: DbLike,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const result = await db.personalMeetupInvitation.updateMany({
    where: {
      status: "PENDING",
      scheduledStartsAt: { lte: now },
      OR: [{ senderId: userId }, { recipientId: userId }],
    },
    data: {
      status: "EXPIRED",
      expiredAt: now,
    },
  });
  return result.count;
}

export async function reconcileLazyExpiredMeetupInviteById(
  db: DbLike,
  inviteId: string,
  now: Date = new Date(),
): Promise<void> {
  await db.personalMeetupInvitation.updateMany({
    where: {
      id: inviteId,
      status: "PENDING",
      scheduledStartsAt: { lte: now },
    },
    data: {
      status: "EXPIRED",
      expiredAt: now,
    },
  });
}
