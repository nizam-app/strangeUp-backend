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
import type { GroupPostPhotoDto } from "./group-content.dto.js";
import {
  assertGroupCommunityInteractiveEnabled,
  postMediaContentPath,
} from "./group-content-policy.js";
import type { GroupContentStorage } from "./group-content.storage.js";

export class GroupPostMediaService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly env: AppEnv,
    private readonly storage: GroupContentStorage,
  ) {}

  async attachPhoto(
    viewer: User,
    groupId: string,
    postId: string,
    file: Express.Multer.File | undefined,
  ): Promise<GroupPostPhotoDto> {
    assertGroupCommunityInteractiveEnabled(this.env);
    if (!file?.buffer?.length) {
      throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
    }

    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));

    const post = await this.db.communityPost.findUnique({
      where: { id: postId },
      include: { photoMedia: true },
    });
    if (!post || post.groupId !== groupId || post.moderation !== "VISIBLE") {
      throw groupNotFound();
    }
    if (post.authorId !== viewer.id) {
      throw groupForbidden("Only the post author can attach media");
    }
    if (post.photoMedia && post.photoMedia.lifecycle === "ACTIVE") {
      throw new AppError("CONFLICT", "This post already has a photo attachment", 409);
    }

    const group = await this.db.communityGroup.findUnique({
      where: { id: groupId },
      select: { status: true },
    });
    if (!group || group.status !== "ACTIVE") {
      throw groupForbidden("This group is not accepting media");
    }

    const processed = await processAvatarUpload(file.buffer);
    const stored = await this.storage.save(groupId, processed.buffer, processed.contentType);

    try {
      const media = await this.db.communityGroupMedia.create({
        data: {
          groupId,
          kind: "POST_ATTACHMENT",
          lifecycle: "ACTIVE",
          storageKey: stored.storageKey,
          contentType: processed.contentType,
          byteSize: processed.buffer.length,
          authorId: viewer.id,
          postId,
        },
      });
      return {
        mediaId: media.id,
        contentPath: postMediaContentPath(groupId, postId, media.id),
      };
    } catch (err) {
      await this.storage.deleteByStorageKey(stored.storageKey, groupId).catch(() => undefined);
      throw err;
    }
  }

  async getPhotoBytes(
    viewer: User,
    groupId: string,
    postId: string,
    mediaId: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    assertGroupCommunityInteractiveEnabled(this.env);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));

    const media = await this.db.communityGroupMedia.findUnique({
      where: { id: mediaId },
      include: { post: { select: { id: true, groupId: true, authorId: true, moderation: true } } },
    });
    if (
      !media ||
      media.groupId !== groupId ||
      media.kind !== "POST_ATTACHMENT" ||
      media.lifecycle !== "ACTIVE" ||
      !media.post ||
      media.post.id !== postId ||
      media.post.moderation !== "VISIBLE"
    ) {
      throw groupNotFound();
    }

    if (await isBlockedEitherDirection(this.db, viewer.id, media.post.authorId)) {
      throw groupNotFound();
    }

    const buffer = await this.storage.readBytes(media.storageKey, groupId);
    return { buffer, contentType: media.contentType };
  }

  async removePhoto(
    viewer: User,
    groupId: string,
    postId: string,
    mediaId: string,
  ): Promise<{ removed: true }> {
    assertGroupCommunityInteractiveEnabled(this.env);
    const membership = requireActiveMember(await loadMembership(this.db, groupId, viewer.id));

    const media = await this.db.communityGroupMedia.findUnique({
      where: { id: mediaId },
      include: { post: { select: { id: true, groupId: true, authorId: true } } },
    });
    if (
      !media ||
      media.groupId !== groupId ||
      media.kind !== "POST_ATTACHMENT" ||
      !media.post ||
      media.post.id !== postId
    ) {
      throw groupNotFound();
    }

    const isAuthor = media.authorId === viewer.id;
    if (!isAuthor) {
      assertCanModerateContent(membership.role);
    }

    if (media.lifecycle === "REMOVED") {
      return { removed: true };
    }

    await this.db.communityGroupMedia.update({
      where: { id: mediaId },
      data: { lifecycle: "REMOVED", removedAt: new Date() },
    });
    await this.storage.deleteByStorageKey(media.storageKey, groupId).catch(() => undefined);
    return { removed: true };
  }

  async loadActivePhotoForPost(groupId: string, postId: string): Promise<GroupPostPhotoDto | null> {
    if (!this.env.GROUP_COMMUNITY_INTERACTIVE_ENABLED) {
      return null;
    }
    const media = await this.db.communityGroupMedia.findFirst({
      where: {
        groupId,
        postId,
        kind: "POST_ATTACHMENT",
        lifecycle: "ACTIVE",
      },
    });
    if (!media) {
      return null;
    }
    return {
      mediaId: media.id,
      contentPath: postMediaContentPath(groupId, postId, media.id),
    };
  }
}
