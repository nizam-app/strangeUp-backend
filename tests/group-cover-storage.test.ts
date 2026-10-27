import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalGroupCoverStorage } from "../src/modules/groups/group-cover.storage.js";

const GROUP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("LocalGroupCoverStorage", () => {
  let root: string;
  let storage: LocalGroupCoverStorage;

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects path traversal in storage keys", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "group-cover-"));
    storage = new LocalGroupCoverStorage(root);
    expect(() => storage.resolveAbsolutePath("../../etc/passwd")).toThrow();
  });

  it("scopes delete to the owning group id", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "group-cover-"));
    storage = new LocalGroupCoverStorage(root);
    const otherGroup = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const stored = await storage.save(GROUP_ID, Buffer.from("x"), "image/png");
    expect(stored.storageKey.startsWith(`${GROUP_ID}/`)).toBe(true);
    await expect(storage.deleteByStorageKey(stored.storageKey, otherGroup)).rejects.toThrow();
  });
});
