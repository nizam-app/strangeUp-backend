import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error.js";
import type { AvatarStoredContentType } from "./avatar.constants.js";

export type StoredAvatar = {
  storageKey: string;
  absolutePath: string;
};

export type AvatarStorage = {
  save(
    userId: string,
    buffer: Buffer,
    contentType: AvatarStoredContentType,
  ): Promise<Pick<StoredAvatar, "storageKey">>;
  readBytes(storageKey: string, userId: string): Promise<Buffer>;
  assertStorageKeyOwnedByUser(storageKey: string, userId: string): void;
  deleteByStorageKey(storageKey: string, userId: string): Promise<void>;
  deleteUserAvatar(userId: string): Promise<void>;
};

const EXT_BY_CONTENT_TYPE: Record<AvatarStoredContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class LocalAvatarStorage implements AvatarStorage {
  constructor(private readonly rootDir: string) {}

  private resolvedRoot(): string {
    return path.resolve(this.rootDir);
  }

  private userDir(userId: string): string {
    return path.join(this.resolvedRoot(), userId);
  }

  private assertUnderRoot(absolutePath: string): void {
    const root = this.resolvedRoot();
    const resolved = path.resolve(absolutePath);
    const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (resolved !== root && !resolved.startsWith(rootPrefix)) {
      throw new AppError("INTERNAL_ERROR", "Invalid avatar storage path", 500);
    }
  }

  async save(
    userId: string,
    buffer: Buffer,
    contentType: AvatarStoredContentType,
  ): Promise<StoredAvatar> {
    const dir = this.userDir(userId);
    await mkdir(dir, { recursive: true });
    const ext = EXT_BY_CONTENT_TYPE[contentType];
    const fileName = `${randomUUID()}.${ext}`;
    const storageKey = `${userId}/${fileName}`;
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
      throw new AppError("INTERNAL_ERROR", "Invalid avatar storage key", 500);
    }
    const [keyUserId] = segments;
    if (!/^[0-9a-f-]{36}$/i.test(keyUserId)) {
      throw new AppError("INTERNAL_ERROR", "Invalid avatar storage key", 500);
    }
    return absolutePath;
  }

  assertStorageKeyOwnedByUser(storageKey: string, userId: string): void {
    const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
    const segments = normalized.split(/[/\\]/).filter(Boolean);
    if (segments[0] !== userId) {
      throw new AppError("INTERNAL_ERROR", "Avatar storage key mismatch", 500);
    }
  }

  async readBytes(storageKey: string, userId: string): Promise<Buffer> {
    this.assertStorageKeyOwnedByUser(storageKey, userId);
    const absolutePath = this.resolveAbsolutePath(storageKey);
    try {
      return await readFile(absolutePath);
    } catch {
      throw new AppError("NOT_FOUND", "Avatar not found", 404);
    }
  }

  async deleteByStorageKey(storageKey: string, userId: string): Promise<void> {
    this.assertStorageKeyOwnedByUser(storageKey, userId);
    const absolutePath = this.resolveAbsolutePath(storageKey);
    await rm(absolutePath, { force: true });
  }

  async deleteUserAvatar(userId: string): Promise<void> {
    const dir = this.userDir(userId);
    this.assertUnderRoot(dir);
    await rm(dir, { recursive: true, force: true });
  }
}
