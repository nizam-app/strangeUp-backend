import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error.js";
import type { AvatarStoredContentType } from "../profile-media/avatar.constants.js";

export type StoredGroupCover = {
  storageKey: string;
  absolutePath: string;
};

export type GroupCoverStorage = {
  save(
    groupId: string,
    buffer: Buffer,
    contentType: AvatarStoredContentType,
  ): Promise<Pick<StoredGroupCover, "storageKey">>;
  readBytes(storageKey: string, groupId: string): Promise<Buffer>;
  assertStorageKeyOwnedByGroup(storageKey: string, groupId: string): void;
  deleteByStorageKey(storageKey: string, groupId: string): Promise<void>;
};

const EXT_BY_CONTENT_TYPE: Record<AvatarStoredContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const UUID_RE = /^[0-9a-f-]{36}$/i;

export class LocalGroupCoverStorage implements GroupCoverStorage {
  constructor(private readonly rootDir: string) {}

  private resolvedRoot(): string {
    return path.resolve(this.rootDir);
  }

  private assertUnderRoot(absolutePath: string): void {
    const root = this.resolvedRoot();
    const resolved = path.resolve(absolutePath);
    const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (resolved !== root && !resolved.startsWith(rootPrefix)) {
      throw new AppError("INTERNAL_ERROR", "Invalid group cover storage path", 500);
    }
  }

  async save(
    groupId: string,
    buffer: Buffer,
    contentType: AvatarStoredContentType,
  ): Promise<StoredGroupCover> {
    const dir = path.join(this.resolvedRoot(), groupId);
    await mkdir(dir, { recursive: true });
    const ext = EXT_BY_CONTENT_TYPE[contentType];
    const fileName = `${randomUUID()}.${ext}`;
    const storageKey = `${groupId}/${fileName}`;
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
    if (segments.length < 2) {
      throw new AppError("INTERNAL_ERROR", "Invalid group cover storage key", 500);
    }
    if (!UUID_RE.test(segments[0])) {
      throw new AppError("INTERNAL_ERROR", "Invalid group cover storage key", 500);
    }
    return absolutePath;
  }

  assertStorageKeyOwnedByGroup(storageKey: string, groupId: string): void {
    const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
    const segments = normalized.split(/[/\\]/).filter(Boolean);
    if (segments[0] !== groupId) {
      throw new AppError("INTERNAL_ERROR", "Group cover storage key mismatch", 500);
    }
  }

  async readBytes(storageKey: string, groupId: string): Promise<Buffer> {
    this.assertStorageKeyOwnedByGroup(storageKey, groupId);
    const absolutePath = this.resolveAbsolutePath(storageKey);
    try {
      return await readFile(absolutePath);
    } catch {
      throw new AppError("NOT_FOUND", "Cover not found", 404);
    }
  }

  async deleteByStorageKey(storageKey: string, groupId: string): Promise<void> {
    this.assertStorageKeyOwnedByGroup(storageKey, groupId);
    const absolutePath = this.resolveAbsolutePath(storageKey);
    await rm(absolutePath, { force: true });
  }
}
