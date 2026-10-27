import type { DatabaseClient } from "../../infrastructure/database/prisma.js";

type BlockLookup = {
  userBlock: Pick<DatabaseClient["userBlock"], "findFirst">;
};

/** True when either user has blocked the other. */
export async function isBlockedEitherDirection(
  db: BlockLookup,
  userAId: string,
  userBId: string,
): Promise<boolean> {
  if (userAId === userBId) {
    return false;
  }
  const row = await db.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userAId, blockedId: userBId },
        { blockerId: userBId, blockedId: userAId },
      ],
    },
    select: { blockerId: true },
  });
  return row !== null;
}
