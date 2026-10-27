import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error.js";
import type { AvatarStoredContentType } from "../profile-media/avatar.constants.js";

export type StoredActivityCover = {
  storageKey: string;
  absolutePath: string;
};

export type ActivityCoverStorage = {
  save(
    hostId: string,
    activityId: string,
    buffer: Buffer,
    contentType: AvatarStoredContentType,
  ): Promise<Pick<StoredActivityCover, "storageKey">>;
  readBytes(storageKey: string, hostId: string): Promise<Buffer>;
  assertStorageKeyOwnedByHost(storageKey: string, hostId: string): void;
  deleteByStorageKey(storageKey: string, hostId: string): Promise<void>;
};

const EXT_BY_CONTENT_TYPE: Record<AvatarStoredContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class LocalActivityCoverStorage implements ActivityCoverStorage {
  constructor(private readonly rootDir: string) {}

  private resolvedRoot(): string {
    return path.resolve(this.rootDir);
  }

  private assertUnderRoot(absolutePath: string): void {
    const root = this.resolvedRoot();
    const resolved = path.resolve(absolutePath);
    const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (resolved !== root && !resolved.startsWith(rootPrefix)) {
      throw new AppError("INTERNAL_ERROR", "Invalid activity cover storage path", 500);
    }
  }

  async save(
    hostId: string,
    activityId: string,
    buffer: Buffer,
    contentType: AvatarStoredContentType,
  ): Promise<StoredActivityCover> {
    const dir = path.join(this.resolvedRoot(), hostId, activityId);
    await mkdir(dir, { recursive: true });
    const ext = EXT_BY_CONTENT_TYPE[contentType];
    const fileName = `${randomUUID()}.${ext}`;
    const storageKey = `${hostId}/${activityId}/${fileName}`;
    const absolutePath = path.join(dir, fileName);
    this.assertUnderRoot(absolutePath);

    const tmpPath = path.join(dir, `.${fileName}.part`);
    this.assertUnderRoot(tmpPath);
    try {
      await writeFile(tmpPath, buffer);
      await rename(tmpPath, absolutePath);
    } catch (err) {
      await rm(tmpPath, { force: true });
      throw err;
    }

    return { storageKey, absolutePath };
  }

  resolveAbsolutePath(storageKey: string): string {
    const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
    const absolutePath = path.join(this.resolvedRoot(), normalized);
    this.assertUnderRoot(absolutePath);
    const segments = normalized.split(/[/\\]/).filter(Boolean);
    if (segments.length < 3) {
      throw new AppError("INTERNAL_ERROR", "Invalid activity cover storage key", 500);
    }
    const [keyHostId, keyActivityId] = segments;
    if (!/^[0-9a-f-]{36}$/i.test(keyHostId) || !/^[0-9a-f-]{36}$/i.test(keyActivityId)) {
      throw new AppError("INTERNAL_ERROR", "Invalid activity cover storage key", 500);
    }
    return absolutePath;
  }

  assertStorageKeyOwnedByHost(storageKey: string, hostId: string): void {
    const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
    const segments = normalized.split(/[/\\]/).filter(Boolean);
    if (segments[0] !== hostId) {
      throw new AppError("INTERNAL_ERROR", "Activity cover storage key mismatch", 500);
    }
  }

  async readBytes(storageKey: string, hostId: string): Promise<Buffer> {
    this.assertStorageKeyOwnedByHost(storageKey, hostId);
    const absolutePath = this.resolveAbsolutePath(storageKey);
    try {
      return await readFile(absolutePath);
    } catch {
      throw new AppError("NOT_FOUND", "Cover not found", 404);
    }
  }

  async deleteByStorageKey(storageKey: string, hostId: string): Promise<void> {
    this.assertStorageKeyOwnedByHost(storageKey, hostId);
    const absolutePath = this.resolveAbsolutePath(storageKey);
    await rm(absolutePath, { force: true });
  }
}
