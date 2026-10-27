import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error.js";
import type { MediaObjectStore } from "../../infrastructure/media-storage/media-object-store.types.js";
import { isMediaStorageNotFound } from "../../infrastructure/media-storage/media-storage.errors.js";
import {
  assertStorageKeySegments,
  assertUuidSegment,
} from "../../infrastructure/media-storage/storage-key.js";
import type { AvatarStoredContentType } from "../profile-media/avatar.constants.js";
import type { GroupCoverStorage, StoredGroupCover } from "./group-cover.storage.js";

const EXT_BY_CONTENT_TYPE: Record<AvatarStoredContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class S3GroupCoverStorage implements GroupCoverStorage {
  constructor(private readonly store: MediaObjectStore) {}

  async save(
    groupId: string,
    buffer: Buffer,
    contentType: AvatarStoredContentType,
  ): Promise<Pick<StoredGroupCover, "storageKey">> {
    assertUuidSegment(groupId);
    const ext = EXT_BY_CONTENT_TYPE[contentType];
    const fileName = `${randomUUID()}.${ext}`;
    const storageKey = `${groupId}/${fileName}`;
    await this.store.putObject({ storageKey, body: buffer, contentType });
    return { storageKey };
  }

  assertStorageKeyOwnedByGroup(storageKey: string, groupId: string): void {
    assertStorageKeySegments(storageKey, groupId, 2);
  }

  async readBytes(storageKey: string, groupId: string): Promise<Buffer> {
    this.assertStorageKeyOwnedByGroup(storageKey, groupId);
    try {
      return (await this.store.getObject(storageKey)).body;
    } catch (err) {
      if (isMediaStorageNotFound(err)) {
        throw new AppError("NOT_FOUND", "Cover not found", 404);
      }
      throw err;
    }
  }

  async deleteByStorageKey(storageKey: string, groupId: string): Promise<void> {
    this.assertStorageKeyOwnedByGroup(storageKey, groupId);
    await this.store.deleteObject(storageKey).catch(() => undefined);
  }
}
