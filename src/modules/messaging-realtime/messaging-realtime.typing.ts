const lastTypingStart = new Map<string, number>();

export function typingKey(userId: string, roomKey: string): string {
  return `${userId}:${roomKey}`;
}

/** Returns false when throttled (caller should not broadcast). */
export function shouldEmitTypingStart(
  userId: string,
  roomKey: string,
  minIntervalMs: number,
): boolean {
  const key = typingKey(userId, roomKey);
  const now = Date.now();
  const last = lastTypingStart.get(key) ?? 0;
  if (now - last < minIntervalMs) {
    return false;
  }
  lastTypingStart.set(key, now);
  return true;
}

export function clearTypingStateForSocket(userId: string): void {
  for (const key of lastTypingStart.keys()) {
    if (key.startsWith(`${userId}:`)) {
      lastTypingStart.delete(key);
    }
  }
}
