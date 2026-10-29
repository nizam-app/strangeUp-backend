import type { ReadStream } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { AppEnv } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import type { MediaObjectStore } from "../../infrastructure/media-storage/media-object-store.types.js";
import { isMediaStorageNotFound } from "../../infrastructure/media-storage/media-storage.errors.js";
import { S3MediaObjectStore } from "../../infrastructure/media-storage/s3-media-object-store.js";
import { getSharedS3Client, resolveS3MediaConfig } from "../../infrastructure/media-storage/s3-config.js";
import {
  assertStorageKeySegments,
  assertUuidSegment,
} from "../../infrastructure/media-storage/storage-key.js";
import type { AvatarStoredContentType } from "../profile-media/avatar.constants.js";
import { LocalStoreImageStorage } from "./store-image.storage.js";

const EXT_BY_CONTENT_TYPE: Record<AvatarStoredContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type StoreProductImageStorage = {
  openReadStream(storageKey: string): Promise<{ stream: ReadStream | Readable; absolutePath?: string }>;
  save(
    productId: string,
    buffer: Buffer,
    contentType: AvatarStoredContentType,
  ): Promise<{ storageKey: string }>;
  deleteByStorageKey(storageKey: string, productId: string): Promise<void>;
  assertStorageKeyOwnedByProduct(storageKey: string, productId: string): void;
};

class LocalStoreProductImageStorage implements StoreProductImageStorage {
  constructor(private readonly rootDir: string) {}

  private resolvedRoot(): string {
    return path.resolve(this.rootDir);
  }

  private assertUnderRoot(absolutePath: string): void {
    const root = this.resolvedRoot();
    const resolved = path.resolve(absolutePath);
    const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (resolved !== root && !resolved.startsWith(rootPrefix)) {
      throw new AppError("INTERNAL_ERROR", "Invalid store image storage path", 500);
    }
  }

  assertStorageKeyOwnedByProduct(storageKey: string, productId: string): void {
    const segments = assertStorageKeySegments(storageKey, productId, 2);
    assertUuidSegment(segments[0]);
  }

  async save(
    productId: string,
    buffer: Buffer,
    contentType: AvatarStoredContentType,
  ): Promise<{ storageKey: string }> {
    assertUuidSegment(productId);
    const dir = path.join(this.resolvedRoot(), productId);
    await mkdir(dir, { recursive: true });
    const ext = EXT_BY_CONTENT_TYPE[contentType];
    const fileName = `${randomUUID()}.${ext}`;
    const storageKey = `${productId}/${fileName}`;
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
    return { storageKey };
  }

  async openReadStream(storageKey: string): Promise<{ stream: ReadStream; absolutePath: string }> {
    const legacy = new LocalStoreImageStorage(this.rootDir);
    const absolutePath = legacy.resolveAbsolutePath(storageKey);
    const { stream } = await legacy.openReadStream(storageKey);
    return { stream, absolutePath };
  }

  async deleteByStorageKey(storageKey: string, productId: string): Promise<void> {
    this.assertStorageKeyOwnedByProduct(storageKey, productId);
    const absolutePath = path.join(this.resolvedRoot(), ...storageKey.split("/"));
    this.assertUnderRoot(absolutePath);
    await rm(absolutePath, { force: true });
  }
}

class S3StoreProductImageStorage implements StoreProductImageStorage {
  constructor(private readonly store: MediaObjectStore) {}

  assertStorageKeyOwnedByProduct(storageKey: string, productId: string): void {
    const segments = assertStorageKeySegments(storageKey, productId, 2);
    assertUuidSegment(segments[0]);
  }

  async save(
    productId: string,
    buffer: Buffer,
    contentType: AvatarStoredContentType,
  ): Promise<{ storageKey: string }> {
    assertUuidSegment(productId);
    const ext = EXT_BY_CONTENT_TYPE[contentType];
    const storageKey = `${productId}/${randomUUID()}.${ext}`;
    await this.store.putObject({ storageKey, body: buffer, contentType });
    return { storageKey };
  }

  async openReadStream(storageKey: string): Promise<{ stream: Readable }> {
    try {
      const result = await this.store.getObject(storageKey);
      return { stream: Readable.from(result.body) };
    } catch (err) {
      if (isMediaStorageNotFound(err)) {
        throw new AppError("NOT_FOUND", "Image not found", 404);
      }
      throw err;
    }
  }

  async deleteByStorageKey(storageKey: string, productId: string): Promise<void> {
    this.assertStorageKeyOwnedByProduct(storageKey, productId);
    await this.store.deleteObject(storageKey).catch(() => undefined);
  }
}

/** Reads legacy local keys when primary backend is S3 (migration period only). */
class StoreProductImageStorageWithLegacyLocalRead implements StoreProductImageStorage {
  constructor(
    private readonly primary: StoreProductImageStorage,
    private readonly localFallback: LocalStoreProductImageStorage,
  ) {}

  assertStorageKeyOwnedByProduct(storageKey: string, productId: string): void {
    this.primary.assertStorageKeyOwnedByProduct(storageKey, productId);
  }

  save(productId: string, buffer: Buffer, contentType: AvatarStoredContentType) {
    return this.primary.save(productId, buffer, contentType);
  }

  deleteByStorageKey(storageKey: string, productId: string) {
    return this.primary.deleteByStorageKey(storageKey, productId);
  }

  async openReadStream(storageKey: string) {
    try {
      return await this.primary.openReadStream(storageKey);
    } catch (err) {
      if (err instanceof AppError && err.code === "NOT_FOUND") {
        return this.localFallback.openReadStream(storageKey);
      }
      throw err;
    }
  }
}

export function createStoreProductImageStorage(env: AppEnv): StoreProductImageStorage {
  const local = new LocalStoreProductImageStorage(env.STORE_UPLOAD_DIR);
  if (env.MEDIA_STORAGE_BACKEND === "s3") {
    const config = resolveS3MediaConfig(env);
    const s3Store = new S3MediaObjectStore({
      client: getSharedS3Client(env),
      bucket: config.bucket,
      namespace: "store-product",
      keyPrefix: config.keyPrefix,
      requestTimeoutMs: config.requestTimeoutMs,
      maxRetries: config.maxRetries,
    });
    const s3 = new S3StoreProductImageStorage(s3Store);
    return new StoreProductImageStorageWithLegacyLocalRead(s3, local);
  }
  return local;
}
