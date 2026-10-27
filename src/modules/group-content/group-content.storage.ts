import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error.js";
import type { AvatarStoredContentType } from "../profile-media/avatar.constants.js";

export type StoredGroupContentBlob = {
  storageKey: string;
  absolutePath: string;
};

export type GroupContentStorage = {
  save(
    groupId: string,
    buffer: Buffer,
    contentType: AvatarStoredContentType,
  ): Promise<Pick<StoredGroupContentBlob, "storageKey">>;
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

/**
 * Opaque group content blobs under `{root}/{groupId}/content/{uuid}.ext`.
 * Separate from group cover keys (`{groupId}/{uuid}.ext`).
 */
export class LocalGroupContentStorage implements GroupContentStorage {
  constructor(private readonly rootDir: string) {}

  private resolvedRoot(): string {
    return path.resolve(this.rootDir);
  }

  private assertUnderRoot(absolutePath: string): void {
    const root = this.resolvedRoot();
    const resolved = path.resolve(absolutePath);
    const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (resolved !== root && !resolved.startsWith(rootPrefix)) {
      throw new AppError("INTERNAL_ERROR", "Invalid group content storage path", 500);
    }
  }

  async save(
    groupId: string,
    buffer: Buffer,
    contentType: AvatarStoredContentType,
  ): Promise<StoredGroupContentBlob> {
    const dir = path.join(this.resolvedRoot(), groupId, "content");
    await mkdir(dir, { recursive: true });
    const ext = EXT_BY_CONTENT_TYPE[contentType];
    const fileName = `${randomUUID()}.${ext}`;
    const storageKey = `${groupId}/content/${fileName}`;
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
    if (segments.length < 3 || segments[1] !== "content") {
      throw new AppError("INTERNAL_ERROR", "Invalid group content storage key", 500);
    }
    if (!UUID_RE.test(segments[0])) {
      throw new AppError("INTERNAL_ERROR", "Invalid group content storage key", 500);
    }
    return absolutePath;
  }

  assertStorageKeyOwnedByGroup(storageKey: string, groupId: string): void {
    const normalized = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
    const segments = normalized.split(/[/\\]/).filter(Boolean);
    if (segments[0] !== groupId) {
      throw new AppError("INTERNAL_ERROR", "Group content storage key mismatch", 500);
    }
  }

  async readBytes(storageKey: string, groupId: string): Promise<Buffer> {
    this.assertStorageKeyOwnedByGroup(storageKey, groupId);
    const absolutePath = this.resolveAbsolutePath(storageKey);
    try {
      return await readFile(absolutePath);
    } catch {
      throw new AppError("NOT_FOUND", "Media not found", 404);
    }
  }

  async deleteByStorageKey(storageKey: string, groupId: string): Promise<void> {
    this.assertStorageKeyOwnedByGroup(storageKey, groupId);
    const absolutePath = this.resolveAbsolutePath(storageKey);
    await rm(absolutePath, { force: true });
  }
}
