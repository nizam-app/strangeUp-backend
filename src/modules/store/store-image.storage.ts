import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../../common/errors/app-error.js";

export class LocalStoreImageStorage {
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

  resolveAbsolutePath(storageKey: string): string {
    const normalized = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
    if (normalized.includes("..") || normalized.includes("\0")) {
      throw new AppError("VALIDATION_ERROR", "Invalid image reference", 400);
    }
    const absolutePath = path.join(this.resolvedRoot(), ...normalized.split("/"));
    this.assertUnderRoot(absolutePath);
    return absolutePath;
  }

  async openReadStream(storageKey: string): Promise<{
    stream: ReturnType<typeof createReadStream>;
    absolutePath: string;
  }> {
    const absolutePath = this.resolveAbsolutePath(storageKey);
    try {
      await access(absolutePath);
    } catch {
      throw new AppError("NOT_FOUND", "Image not found", 404);
    }
    return { stream: createReadStream(absolutePath), absolutePath };
  }
}
