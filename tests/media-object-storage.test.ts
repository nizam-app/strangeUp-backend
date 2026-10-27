import { describe, expect, it } from "vitest";
import { S3AvatarStorage } from "../src/modules/profile-media/s3-avatar.storage.js";
import { InMemoryMediaObjectStore } from "../src/infrastructure/media-storage/in-memory-media-object-store.js";
import { buildS3ObjectKey } from "../src/infrastructure/media-storage/storage-key.js";
import { S3MediaObjectStore } from "../src/infrastructure/media-storage/s3-media-object-store.js";
import { MediaStorageError } from "../src/infrastructure/media-storage/media-storage.errors.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("media object storage (Task 020)", () => {
  it("buildS3ObjectKey scopes namespace and rejects traversal", () => {
    expect(buildS3ObjectKey("profile", "strangeup", `${USER_ID}/abc.jpg`)).toBe(
      "strangeup/profile/11111111-1111-4111-8111-111111111111/abc.jpg",
    );
    expect(() => buildS3ObjectKey("profile", undefined, `${USER_ID}/../../etc/passwd`)).toThrow();
  });

  it("S3AvatarStorage saves and reads via in-memory store", async () => {
    const store = new InMemoryMediaObjectStore();
    const avatar = new S3AvatarStorage(store);
    const body = Buffer.from("jpeg-bytes");
    const saved = await avatar.save(USER_ID, body, "image/jpeg");
    expect(saved.storageKey.startsWith(`${USER_ID}/`)).toBe(true);
    const roundTrip = await avatar.readBytes(saved.storageKey, USER_ID);
    expect(roundTrip.equals(body)).toBe(true);
    await avatar.deleteByStorageKey(saved.storageKey, USER_ID);
    await expect(avatar.readBytes(saved.storageKey, USER_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("S3AvatarStorage rejects cross-tenant read", async () => {
    const store = new InMemoryMediaObjectStore();
    const avatar = new S3AvatarStorage(store);
    const saved = await avatar.save(USER_ID, Buffer.from("x"), "image/png");
    const other = "22222222-2222-4222-8222-222222222222";
    await expect(avatar.readBytes(saved.storageKey, other)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("S3MediaObjectStore maps missing objects to NOT_FOUND", async () => {
    const send = () => {
      const err = new Error("NotFound");
      err.name = "NotFound";
      return Promise.reject(err);
    };
    const store = new S3MediaObjectStore({
      client: { send } as never,
      bucket: "private-bucket",
      namespace: "profile",
      requestTimeoutMs: 100,
      maxRetries: 0,
    });
    await expect(store.getObject(`${USER_ID}/missing.jpg`)).rejects.toBeInstanceOf(
      MediaStorageError,
    );
  });
});
