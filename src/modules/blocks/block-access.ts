import type { DatabaseClient } from "../../infrastructure/database/prisma.js";

type BlockLookup = {
  userBlock: Pick<DatabaseClient["userBlock"], "findFirst" | "findMany">;
};

/** Peer user IDs involved in a block with `viewerId` (either direction). */
export async function loadBlockedPeerIds(
  db: BlockLookup,
  viewerId: string,
): Promise<Set<string>> {
  const rows = await db.userBlock.findMany({
    where: {
      OR: [{ blockerId: viewerId }, { blockedId: viewerId }],
    },
    select: { blockerId: true, blockedId: true },
  });
  const peers = new Set<string>();
  for (const row of rows) {
    peers.add(row.blockerId === viewerId ? row.blockedId : row.blockerId);
  }
  return peers;
}

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
