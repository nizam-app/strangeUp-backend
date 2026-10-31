import type { User } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { assertGroupAccess, loadMembership, requireActiveMember } from "../groups/group-access.js";
import { toPolicyActor } from "../policy/account-policy.js";
import { assertFullAccess, socialNotFound } from "../social/social-access.js";
import { canAccessAcceptedConversation, otherParticipantId } from "../social/social-policy.js";

export async function assertCanSubscribeDirectConversation(
  db: DatabaseClient,
  viewer: User,
  conversationId: string,
): Promise<{ otherUserId: string }> {
  assertFullAccess(viewer);
  const conversation = await db.directConversation.findUnique({
    where: { id: conversationId },
    include: { participants: { select: { userId: true } } },
  });
  if (!conversation || !conversation.participants.some((p) => p.userId === viewer.id)) {
    throw socialNotFound();
  }
  const otherUserId = otherParticipantId(
    conversation.participantLowId,
    conversation.participantHighId,
    viewer.id,
  );
  const blocked = await isBlockedEitherDirection(db, viewer.id, otherUserId);
  if (!canAccessAcceptedConversation(toPolicyActor(viewer), blocked)) {
    throw socialNotFound();
  }
  return { otherUserId };
}

export async function assertCanSubscribeGroupChat(
  db: DatabaseClient,
  viewer: User,
  groupId: string,
): Promise<void> {
  assertGroupAccess(viewer);
  requireActiveMember(await loadMembership(db, groupId, viewer.id));
}
