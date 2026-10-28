import { MESSAGING_SOCKET_EVENTS } from "./messaging-realtime.constants.js";

type TypingStopPayload = {
  target: "dm" | "group";
  id: string;
  userId: string;
};

const timersBySocket = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();

function socketTimers(socketId: string): Map<string, ReturnType<typeof setTimeout>> {
  let map = timersBySocket.get(socketId);
  if (!map) {
    map = new Map();
    timersBySocket.set(socketId, map);
  }
  return map;
}

export function scheduleServerTypingExpiry(deps: {
  socketId: string;
  roomKey: string;
  ttlMs: number;
  emitStop: (payload: TypingStopPayload) => void;
  stopContext: TypingStopPayload;
}): void {
  const map = socketTimers(deps.socketId);
  const existing = map.get(deps.roomKey);
  if (existing) {
    clearTimeout(existing);
  }
  const timer = setTimeout(() => {
    deps.emitStop(deps.stopContext);
    map.delete(deps.roomKey);
  }, deps.ttlMs);
  timer.unref?.();
  map.set(deps.roomKey, timer);
}

export function clearServerTypingExpiryForSocket(socketId: string): void {
  const map = timersBySocket.get(socketId);
  if (!map) {
    return;
  }
  for (const timer of map.values()) {
    clearTimeout(timer);
  }
  timersBySocket.delete(socketId);
}

export function emitTypingStopEvent(
  emit: (event: string, payload: unknown) => void,
  context: TypingStopPayload,
): void {
  emit(MESSAGING_SOCKET_EVENTS.typing, {
    eventId: `${context.userId}:auto-stop:${context.target}:${context.id}`,
    target: context.target,
    id: context.id,
    userId: context.userId,
    active: false,
  });
}
