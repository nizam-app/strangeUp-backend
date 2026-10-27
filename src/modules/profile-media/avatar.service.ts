import { readFile } from "node:fs/promises";
import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { canAccessAccount, canEditProfile, toPolicyActor } from "../policy/account-policy.js";
import { AVATAR_MAX_BYTES } from "./avatar.constants.js";
import { processAvatarUpload } from "./avatar-image-processor.js";
import { LocalAvatarStorage } from "./local-avatar-storage.js";

export type AvatarMetaDto = {
  hasAvatar: boolean;
  contentType: string | null;
  updatedAt: string | null;
};

export class AvatarService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly storage: LocalAvatarStorage,
  ) {}

  async getAvatarMeta(user: User): Promise<AvatarMetaDto> {
    const actor = toPolicyActor(user);
    if (!canAccessAccount(actor, user.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    const profile = await this.db.profile.findUnique({
      where: { userId: user.id },
      select: { avatarStorageKey: true, avatarContentType: true, avatarUpdatedAt: true },
    });
    if (!profile) {
      throw new AppError("NOT_FOUND", "Profile not found", 404);
    }

    return {
      hasAvatar: profile.avatarStorageKey !== null,
      contentType: profile.avatarContentType,
      updatedAt: profile.avatarUpdatedAt?.toISOString() ?? null,
    };
  }

  async getAvatarBytes(user: User): Promise<{ buffer: Buffer; contentType: string }> {
    const actor = toPolicyActor(user);
    if (!canAccessAccount(actor, user.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    const profile = await this.db.profile.findUnique({
      where: { userId: user.id },
      select: { avatarStorageKey: true, avatarContentType: true },
    });
    if (!profile?.avatarStorageKey || !profile.avatarContentType) {
      throw new AppError("NOT_FOUND", "Avatar not found", 404);
    }

    this.storage.assertStorageKeyOwnedByUser(profile.avatarStorageKey, user.id);
    const absolutePath = this.storage.resolveAbsolutePath(profile.avatarStorageKey);
    const buffer = await readFile(absolutePath);
    return { buffer, contentType: profile.avatarContentType };
  }

  async replaceAvatar(user: User, file: { buffer: Buffer }): Promise<AvatarMetaDto> {
    const actor = toPolicyActor(user);
    if (!canEditProfile(actor, user.id)) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Profile cannot be edited in the current account state",
        403,
      );
    }

    if (file.buffer.length === 0 || file.buffer.length > AVATAR_MAX_BYTES) {
      throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
    }

    const processed = await processAvatarUpload(file.buffer);

    const profile = await this.db.profile.findUnique({
      where: { userId: user.id },
      select: { avatarStorageKey: true },
    });
    if (!profile) {
      throw new AppError("NOT_FOUND", "Profile not found", 404);
    }

    const previousKey = profile.avatarStorageKey;
    const stored = await this.storage.save(user.id, processed.buffer, processed.contentType);
    const now = new Date();

    try {
      await this.db.profile.update({
        where: { userId: user.id },
        data: {
          avatarStorageKey: stored.storageKey,
          avatarContentType: processed.contentType,
          avatarUpdatedAt: now,
        },
      });
    } catch (err) {
      await this.storage.deleteByStorageKey(stored.storageKey, user.id);
      throw err;
    }

    if (previousKey && previousKey !== stored.storageKey) {
      try {
        await this.storage.deleteByStorageKey(previousKey, user.id);
      } catch {
        // Orphan possible if disk delete fails; logged at infra layer in future ops tooling.
      }
    }

    return {
      hasAvatar: true,
      contentType: processed.contentType,
      updatedAt: now.toISOString(),
    };
  }

  async deleteAvatar(user: User): Promise<AvatarMetaDto> {
    const actor = toPolicyActor(user);
    if (!canEditProfile(actor, user.id)) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Profile cannot be edited in the current account state",
        403,
      );
    }

    const profile = await this.db.profile.findUnique({
      where: { userId: user.id },
      select: { avatarStorageKey: true },
    });
    if (!profile) {
      throw new AppError("NOT_FOUND", "Profile not found", 404);
    }

    const previousKey = profile.avatarStorageKey;

    await this.db.profile.update({
      where: { userId: user.id },
      data: {
        avatarStorageKey: null,
        avatarContentType: null,
        avatarUpdatedAt: null,
      },
    });

    if (previousKey) {
      try {
        await this.storage.deleteByStorageKey(previousKey, user.id);
      } catch {
        // DB cleared; file may remain until manual/orphan cleanup (OWN-PROFILE-05).
      }
    }

    return { hasAvatar: false, contentType: null, updatedAt: null };
  }
}
