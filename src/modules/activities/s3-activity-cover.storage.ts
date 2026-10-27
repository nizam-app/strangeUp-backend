import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error.js";
import type { MediaObjectStore } from "../../infrastructure/media-storage/media-object-store.types.js";
import { isMediaStorageNotFound } from "../../infrastructure/media-storage/media-storage.errors.js";
import {
  assertStorageKeySegments,
  assertUuidSegment,
} from "../../infrastructure/media-storage/storage-key.js";
import type { AvatarStoredContentType } from "../profile-media/avatar.constants.js";
import type { ActivityCoverStorage, StoredActivityCover } from "./activity-cover.storage.js";

const EXT_BY_CONTENT_TYPE: Record<AvatarStoredContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class S3ActivityCoverStorage implements ActivityCoverStorage {
  constructor(private readonly store: MediaObjectStore) {}

  async save(
    hostId: string,
    activityId: string,
    buffer: Buffer,
    contentType: AvatarStoredContentType,
  ): Promise<Pick<StoredActivityCover, "storageKey">> {
    assertUuidSegment(hostId);
    assertUuidSegment(activityId);
    const ext = EXT_BY_CONTENT_TYPE[contentType];
    const fileName = `${randomUUID()}.${ext}`;
    const storageKey = `${hostId}/${activityId}/${fileName}`;
    await this.store.putObject({ storageKey, body: buffer, contentType });
    return { storageKey };
  }

  assertStorageKeyOwnedByHost(storageKey: string, hostId: string): void {
    const segments = assertStorageKeySegments(storageKey, hostId, 3);
    assertUuidSegment(segments[1]);
  }

  async readBytes(storageKey: string, hostId: string): Promise<Buffer> {
    this.assertStorageKeyOwnedByHost(storageKey, hostId);
    try {
      return (await this.store.getObject(storageKey)).body;
    } catch (err) {
      if (isMediaStorageNotFound(err)) {
        throw new AppError("NOT_FOUND", "Cover not found", 404);
      }
      throw err;
    }
  }

  async deleteByStorageKey(storageKey: string, hostId: string): Promise<void> {
    this.assertStorageKeyOwnedByHost(storageKey, hostId);
    await this.store.deleteObject(storageKey).catch(() => undefined);
  }
}
