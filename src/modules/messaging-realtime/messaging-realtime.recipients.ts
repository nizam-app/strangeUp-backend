import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { loadBlockedPeerIds } from "../blocks/block-access.js";
import { assertCanSubscribeDirectConversation } from "./messaging-realtime.access.js";

/** Users who may receive a live DM message event (includes author for multi-device). */
export async function listAuthorizedDmMessageRecipients(
  db: DatabaseClient,
  conversationId: string,
  authorUserId: string,
): Promise<string[]> {
  const conversation = await db.directConversation.findUnique({
    where: { id: conversationId },
    select: {
      participantLowId: true,
      participantHighId: true,
    },
  });
  if (!conversation) {
    return [];
  }
  const participantIds = [conversation.participantLowId, conversation.participantHighId];
  const authorBlocked = await loadBlockedPeerIds(db, authorUserId);
  const recipients: string[] = [];

  for (const participantId of participantIds) {
    if (authorBlocked.has(participantId)) {
      continue;
    }
    const user = await db.user.findUnique({ where: { id: participantId } });
    if (!user) {
      continue;
    }
    try {
      await assertCanSubscribeDirectConversation(db, user, conversationId);
      recipients.push(participantId);
    } catch {
      // not eligible (blocked, suspended, etc.)
    }
  }
  return recipients;
}

/** Users who may receive a live group message event (ACTIVE members, author block rules). */
export async function listAuthorizedGroupMessageRecipients(
  db: DatabaseClient,
  groupId: string,
  authorUserId: string,
): Promise<string[]> {
  const memberships = await db.communityMembership.findMany({
    where: { groupId, status: "ACTIVE" },
    select: { userId: true },
  });
  const authorBlocked = await loadBlockedPeerIds(db, authorUserId);
  const recipients: string[] = [];

  for (const { userId } of memberships) {
    if (authorBlocked.has(userId)) {
      continue;
    }
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      continue;
    }
    try {
      const { assertCanSubscribeGroupChat } = await import("./messaging-realtime.access.js");
      await assertCanSubscribeGroupChat(db, user, groupId);
      recipients.push(userId);
    } catch {
      // left, removed, or ineligible
    }
  }
  return recipients;
}

export async function listAuthorizedDmReadRecipients(
  db: DatabaseClient,
  conversationId: string,
): Promise<string[]> {
  const conversation = await db.directConversation.findUnique({
    where: { id: conversationId },
    select: { participantLowId: true, participantHighId: true },
  });
  if (!conversation) {
    return [];
  }
  const ids = [conversation.participantLowId, conversation.participantHighId];
  const recipients: string[] = [];
  for (const participantId of ids) {
    const user = await db.user.findUnique({ where: { id: participantId } });
    if (!user) {
      continue;
    }
    try {
      await assertCanSubscribeDirectConversation(db, user, conversationId);
      recipients.push(participantId);
    } catch {
      // skip
    }
  }
  return recipients;
}

export async function listAuthorizedGroupReadRecipients(
  db: DatabaseClient,
  groupId: string,
): Promise<string[]> {
  const memberships = await db.communityMembership.findMany({
    where: { groupId, status: "ACTIVE" },
    select: { userId: true },
  });
  const recipients: string[] = [];
  for (const { userId } of memberships) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      continue;
    }
    try {
      const { assertCanSubscribeGroupChat } = await import("./messaging-realtime.access.js");
      await assertCanSubscribeGroupChat(db, user, groupId);
      recipients.push(userId);
    } catch {
      // skip
    }
  }
  return recipients;
}
