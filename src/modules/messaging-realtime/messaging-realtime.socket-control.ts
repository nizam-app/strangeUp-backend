import type { Server } from "socket.io";
import { dmRoom, groupRoom, userRoom } from "./messaging-realtime.constants.js";
import type { MessagingSocketData } from "./messaging-realtime.types.js";

let ioRef: Server | null = null;

export function registerMessagingSocketIo(io: Server): void {
  ioRef = io;
}

export function clearMessagingSocketIo(): void {
  ioRef = null;
}

async function forEachSocket(
  handler: (socket: Awaited<ReturnType<Server["fetchSockets"]>>[number]) => void | Promise<void>,
): Promise<void> {
  if (!ioRef) {
    return;
  }
  const sockets = await ioRef.fetchSockets();
  for (const socket of sockets) {
    await handler(socket);
  }
}

export async function disconnectSessionSockets(sessionId: string): Promise<void> {
  await forEachSocket((socket) => {
    const data = socket.data as MessagingSocketData;
    if (data.sessionId === sessionId) {
      socket.disconnect(true);
    }
  });
}

export async function disconnectUserSockets(userId: string): Promise<void> {
  if (!ioRef) {
    return;
  }
  const sockets = await ioRef.in(userRoom(userId)).fetchSockets();
  for (const socket of sockets) {
    socket.disconnect(true);
  }
}

export async function evictUserFromDirectConversation(
  userId: string,
  conversationId: string,
): Promise<void> {
  if (!ioRef) {
    return;
  }
  const sockets = await ioRef.in(userRoom(userId)).fetchSockets();
  for (const socket of sockets) {
    void socket.leave(dmRoom(conversationId));
  }
}

export async function evictUserFromGroupChat(userId: string, groupId: string): Promise<void> {
  if (!ioRef) {
    return;
  }
  const sockets = await ioRef.in(userRoom(userId)).fetchSockets();
  for (const socket of sockets) {
    void socket.leave(groupRoom(groupId));
  }
}

export async function evictUsersFromSharedDirectConversations(
  db: import("../../infrastructure/database/prisma.js").DatabaseClient,
  userAId: string,
  userBId: string,
): Promise<void> {
  const low = userAId < userBId ? userAId : userBId;
  const high = userAId < userBId ? userBId : userAId;
  const conversation = await db.directConversation.findUnique({
    where: {
      participantLowId_participantHighId: { participantLowId: low, participantHighId: high },
    },
    select: { id: true },
  });
  if (!conversation) {
    return;
  }
  await evictUserFromDirectConversation(userAId, conversation.id);
  await evictUserFromDirectConversation(userBId, conversation.id);
}
