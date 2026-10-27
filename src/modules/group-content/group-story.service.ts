import type { User } from "../../../generated/prisma/client.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { processAvatarUpload } from "../profile-media/avatar-image-processor.js";
import {
  assertCanModerateContent,
  loadMembership,
  requireActiveMember,
} from "../groups/group-access.js";
import { groupForbidden, groupNotFound } from "../groups/group-errors.js";
import type { GroupStorySummaryDto } from "./group-content.dto.js";
import {
  assertGroupCommunityInteractiveEnabled,
  computeStoryExpiresAt,
  isStoryExpired,
  storyMediaContentPath,
} from "./group-content-policy.js";
import type { GroupContentStorage } from "./group-content.storage.js";

export class GroupStoryService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly env: AppEnv,
    private readonly storage: GroupContentStorage,
  ) {}

  async listStories(viewer: User, groupId: string): Promise<GroupStorySummaryDto[]> {
    assertGroupCommunityInteractiveEnabled(this.env);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));

    const now = new Date();
    const rows = await this.db.communityGroupStory.findMany({
      where: {
        groupId,
        moderation: "VISIBLE",
        expiresAt: { gt: now },
        group: { status: "ACTIVE" },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      include: { media: true },
    });

    const out: GroupStorySummaryDto[] = [];
    for (const row of rows) {
      if (row.media.lifecycle !== "ACTIVE") {
        continue;
      }
      if (await isBlockedEitherDirection(this.db, viewer.id, row.authorId)) {
        continue;
      }
      out.push({
        storyId: row.id,
        groupId: row.groupId,
        authorUserId: row.authorId,
        contentPath: storyMediaContentPath(groupId, row.id),
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
      });
    }
    return out;
  }

  async createStory(
    viewer: User,
    groupId: string,
    file: Express.Multer.File | undefined,
  ): Promise<GroupStorySummaryDto> {
    assertGroupCommunityInteractiveEnabled(this.env);
    if (!file?.buffer?.length) {
      throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
    }
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));

    const group = await this.db.communityGroup.findUnique({
      where: { id: groupId },
      select: { status: true },
    });
    if (!group || group.status !== "ACTIVE") {
      throw groupForbidden("This group is not accepting stories");
    }

    const processed = await processAvatarUpload(file.buffer);
    const stored = await this.storage.save(groupId, processed.buffer, processed.contentType);
    const createdAt = new Date();
    const expiresAt = computeStoryExpiresAt(createdAt);

    try {
      const story = await this.db.$transaction(async (tx) => {
        const media = await tx.communityGroupMedia.create({
          data: {
            groupId,
            kind: "STORY",
            lifecycle: "ACTIVE",
            storageKey: stored.storageKey,
            contentType: processed.contentType,
            byteSize: processed.buffer.length,
            authorId: viewer.id,
            expiresAt,
          },
        });
        return tx.communityGroupStory.create({
          data: {
            groupId,
            authorId: viewer.id,
            mediaId: media.id,
            createdAt,
            expiresAt,
          },
        });
      });

      return {
        storyId: story.id,
        groupId: story.groupId,
        authorUserId: story.authorId,
        contentPath: storyMediaContentPath(groupId, story.id),
        createdAt: story.createdAt.toISOString(),
        expiresAt: story.expiresAt.toISOString(),
      };
    } catch (err) {
      await this.storage.deleteByStorageKey(stored.storageKey, groupId).catch(() => undefined);
      throw err;
    }
  }

  async getStoryMediaBytes(
    viewer: User,
    groupId: string,
    storyId: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    assertGroupCommunityInteractiveEnabled(this.env);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));

    const story = await this.db.communityGroupStory.findUnique({
      where: { id: storyId },
      include: { media: true },
    });
    if (
      !story ||
      story.groupId !== groupId ||
      story.moderation !== "VISIBLE" ||
      story.media.lifecycle !== "ACTIVE"
    ) {
      throw groupNotFound();
    }
    if (isStoryExpired(story.expiresAt)) {
      throw groupNotFound();
    }
    if (await isBlockedEitherDirection(this.db, viewer.id, story.authorId)) {
      throw groupNotFound();
    }

    const buffer = await this.storage.readBytes(story.media.storageKey, groupId);
    return { buffer, contentType: story.media.contentType };
  }

  async removeStory(viewer: User, groupId: string, storyId: string): Promise<{ removed: true }> {
    assertGroupCommunityInteractiveEnabled(this.env);
    const membership = requireActiveMember(await loadMembership(this.db, groupId, viewer.id));

    const story = await this.db.communityGroupStory.findUnique({
      where: { id: storyId },
      include: { media: true },
    });
    if (!story || story.groupId !== groupId) {
      throw groupNotFound();
    }

    const isAuthor = story.authorId === viewer.id;
    if (!isAuthor) {
      assertCanModerateContent(membership.role);
    }

    if (story.moderation === "REMOVED") {
      return { removed: true };
    }

    await this.db.$transaction([
      this.db.communityGroupStory.update({
        where: { id: storyId },
        data: {
          moderation: "REMOVED",
          removedAt: new Date(),
          removedById: viewer.id,
        },
      }),
      this.db.communityGroupMedia.update({
        where: { id: story.mediaId },
        data: { lifecycle: "REMOVED", removedAt: new Date() },
      }),
    ]);

    await this.storage.deleteByStorageKey(story.media.storageKey, groupId).catch(() => undefined);
    return { removed: true };
  }
}
