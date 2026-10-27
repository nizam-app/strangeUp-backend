import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalAvatarStorage } from "../src/modules/profile-media/local-avatar-storage.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("LocalAvatarStorage", () => {
  let root: string;
  let storage: LocalAvatarStorage;

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects path traversal in storage keys", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "avatar-root-"));
    storage = new LocalAvatarStorage(root);
    expect(() => storage.resolveAbsolutePath("../../etc/passwd")).toThrow();
  });

  it("scopes delete to owning user id", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "avatar-root-"));
    storage = new LocalAvatarStorage(root);
    const otherUser = "22222222-2222-4222-8222-222222222222";
    const stored = await storage.save(USER_ID, Buffer.from("x"), "image/png");
    await expect(storage.deleteByStorageKey(stored.storageKey, otherUser)).rejects.toThrow();
  });
});
