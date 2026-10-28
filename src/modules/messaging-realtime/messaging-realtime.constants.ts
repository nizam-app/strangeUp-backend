/** Socket.IO event names (server ↔ client). */
export const MESSAGING_SOCKET_EVENTS = {
  connected: "messaging:connected",
  error: "messaging:error",
  subscribed: "messaging:subscribed",
  unsubscribed: "messaging:unsubscribed",

  subscribeDm: "messaging:subscribe_dm",
  unsubscribeDm: "messaging:unsubscribe_dm",
  subscribeGroup: "messaging:subscribe_group",
  unsubscribeGroup: "messaging:unsubscribe_group",

  dmMessage: "messaging:dm_message",
  groupMessage: "messaging:group_message",
  dmRead: "messaging:dm_read",
  groupRead: "messaging:group_read",
  summary: "messaging:summary",
  typing: "messaging:typing",
  typingInput: "messaging:typing",
} as const;

export const DM_ROOM_PREFIX = "dm:";
export const GROUP_ROOM_PREFIX = "group:";
export const USER_ROOM_PREFIX = "user:";

export function dmRoom(conversationId: string): string {
  return `${DM_ROOM_PREFIX}${conversationId}`;
}

export function groupRoom(groupId: string): string {
  return `${GROUP_ROOM_PREFIX}${groupId}`;
}

export function userRoom(userId: string): string {
  return `${USER_ROOM_PREFIX}${userId}`;
}
