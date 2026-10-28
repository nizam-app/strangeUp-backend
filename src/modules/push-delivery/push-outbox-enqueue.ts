import { randomUUID } from "node:crypto";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";

type DbLike = DatabaseClient | Prisma.TransactionClient;

export async function enqueuePushOutboxForNotification(
  db: DbLike,
  input: { userNotificationId: string; recipientId: string },
): Promise<void> {
  try {
    await db.pushNotificationOutbox.create({
      data: {
        id: randomUUID(),
        userNotificationId: input.userNotificationId,
        recipientId: input.recipientId,
      },
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return;
    }
    throw err;
  }
}
