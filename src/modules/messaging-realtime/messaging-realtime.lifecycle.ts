import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import {
  disconnectSessionSockets,
  disconnectUserSockets,
  evictUserFromGroupChat,
  evictUsersFromSharedDirectConversations,
} from "./messaging-realtime.socket-control.js";

export async function onUserBlockEstablished(
  db: DatabaseClient,
  blockerId: string,
  blockedId: string,
): Promise<void> {
  await evictUsersFromSharedDirectConversations(db, blockerId, blockedId);
}

export async function onUserLeftGroup(userId: string, groupId: string): Promise<void> {
  await evictUserFromGroupChat(userId, groupId);
}

export async function onSessionRevoked(sessionId: string): Promise<void> {
  await disconnectSessionSockets(sessionId);
}

export async function onUserLogoutAll(userId: string): Promise<void> {
  await disconnectUserSockets(userId);
}

/** Suspension, deactivation, or other terminal account restriction while sockets may still be connected. */
export async function onUserAccountRestricted(userId: string): Promise<void> {
  await disconnectUserSockets(userId);
}
