import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error.js";
import type { MediaObjectStore } from "../../infrastructure/media-storage/media-object-store.types.js";
import { isMediaStorageNotFound } from "../../infrastructure/media-storage/media-storage.errors.js";
import {
  assertStorageKeySegments,
  assertUuidSegment,
} from "../../infrastructure/media-storage/storage-key.js";
import type { AvatarStoredContentType } from "./avatar.constants.js";
import type { AvatarStorage, StoredAvatar } from "./local-avatar-storage.js";

const EXT_BY_CONTENT_TYPE: Record<AvatarStoredContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class S3AvatarStorage implements AvatarStorage {
  constructor(private readonly store: MediaObjectStore) {}

  async save(
    userId: string,
    buffer: Buffer,
    contentType: AvatarStoredContentType,
  ): Promise<Pick<StoredAvatar, "storageKey">> {
    assertUuidSegment(userId, "Invalid avatar owner");
    const ext = EXT_BY_CONTENT_TYPE[contentType];
    const fileName = `${randomUUID()}.${ext}`;
    const storageKey = `${userId}/${fileName}`;
    await this.store.putObject({ storageKey, body: buffer, contentType });
    return { storageKey };
  }

  assertStorageKeyOwnedByUser(storageKey: string, userId: string): void {
    assertStorageKeySegments(storageKey, userId, 2);
    assertUuidSegment(userId);
  }

  async readBytes(storageKey: string, userId: string): Promise<Buffer> {
    this.assertStorageKeyOwnedByUser(storageKey, userId);
    try {
      const result = await this.store.getObject(storageKey);
      return result.body;
    } catch (err) {
      if (isMediaStorageNotFound(err)) {
        throw new AppError("NOT_FOUND", "Avatar not found", 404);
      }
      throw err;
    }
  }

  async deleteByStorageKey(storageKey: string, userId: string): Promise<void> {
    this.assertStorageKeyOwnedByUser(storageKey, userId);
    await this.store.deleteObject(storageKey).catch(() => undefined);
  }

  async deleteUserAvatar(_userId: string): Promise<void> {
    // Prefix listing/orphan purge is ops-gated (see docs/operations/MEDIA_OBJECT_STORAGE.md).
  }
}
