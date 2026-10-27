import { createInMemoryRateLimitStore } from "./in-memory-store.js";
import type { RateLimitStore } from "./types.js";

let activeStore: RateLimitStore | null = null;

export function configureRateLimitStore(store: RateLimitStore): void {
  activeStore = store;
}

export function getRateLimitStore(): RateLimitStore {
  if (!activeStore) {
    activeStore = createInMemoryRateLimitStore();
  }
  return activeStore;
}

/** Test helper — replaces store with a fresh in-memory backend. */
export function resetRateLimitStoreForTests(): void {
  activeStore = createInMemoryRateLimitStore();
}

export function clearRateLimitStore(): void {
  getRateLimitStore().clear();
}

export async function disconnectRateLimitStore(): Promise<void> {
  if (activeStore?.disconnect) {
    await activeStore.disconnect();
  }
}
