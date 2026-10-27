import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalActivityCoverStorage } from "../src/modules/activities/activity-cover.storage.js";

const HOST_ID = "11111111-1111-4111-8111-111111111111";
const ACTIVITY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("LocalActivityCoverStorage", () => {
  let root: string;
  let storage: LocalActivityCoverStorage;

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects path traversal in storage keys", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "activity-cover-"));
    storage = new LocalActivityCoverStorage(root);
    expect(() => storage.resolveAbsolutePath("../../etc/passwd")).toThrow();
  });

  it("scopes delete to owning host id", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "activity-cover-"));
    storage = new LocalActivityCoverStorage(root);
    const otherHost = "22222222-2222-4222-8222-222222222222";
    const stored = await storage.save(HOST_ID, ACTIVITY_ID, Buffer.from("x"), "image/png");
    expect(stored.storageKey.startsWith(`${HOST_ID}/${ACTIVITY_ID}/`)).toBe(true);
    await expect(storage.deleteByStorageKey(stored.storageKey, otherHost)).rejects.toThrow();
  });
});
