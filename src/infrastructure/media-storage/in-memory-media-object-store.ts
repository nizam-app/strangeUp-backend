import type {
  MediaObjectGetResult,
  MediaObjectStore,
  PutMediaObjectInput,
} from "./media-object-store.types.js";
import { MediaStorageError } from "./media-storage.errors.js";

type Entry = { body: Buffer; contentType: string };

/** Test double for S3-compatible storage (not for production). */
export class InMemoryMediaObjectStore implements MediaObjectStore {
  private readonly objects = new Map<string, Entry>();

  objectKeyFor(storageKey: string): string {
    return storageKey;
  }

  putObject(input: PutMediaObjectInput): Promise<void> {
    this.objects.set(input.storageKey, {
      body: Buffer.from(input.body),
      contentType: input.contentType,
    });
    return Promise.resolve();
  }

  getObject(storageKey: string): Promise<MediaObjectGetResult> {
    const entry = this.objects.get(storageKey);
    if (!entry) {
      return Promise.reject(new MediaStorageError("NOT_FOUND", "Object not found"));
    }
    return Promise.resolve({ body: Buffer.from(entry.body), contentType: entry.contentType });
  }

  deleteObject(storageKey: string): Promise<void> {
    this.objects.delete(storageKey);
    return Promise.resolve();
  }

  objectExists(storageKey: string): Promise<boolean> {
    return Promise.resolve(this.objects.has(storageKey));
  }

  snapshotKeys(): string[] {
    return [...this.objects.keys()];
  }
}
