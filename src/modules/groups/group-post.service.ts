import { Prisma, type User } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { decodeGroupPinnedCursor, encodeGroupPinnedCursor } from "./group-cursor.js";
import { decodeGroupCreatedCursor, encodeGroupCreatedCursor } from "./group-cursor.js";
import { groupForbidden, groupNotFound } from "./group-errors.js";
import {
  assertCanModerateContent,
  assertGroupAccess,
  loadMembership,
  membershipUserSelect,
  requireActiveMember,
} from "./group-access.js";
import { toGroupUserPreview, type GroupCommentDto, type GroupPostDto } from "./group.dto.js";
import { GROUP_LIST_DEFAULT_LIMIT, GROUP_LIST_MAX_LIMIT } from "./group.constants.js";
import type {
  CreateGroupCommentInput,
  CreateGroupPostInput,
  GroupCursorListQuery,
  PatchGroupPostInput,
  PinGroupPostInput,
} from "./group.validation.js";

export class GroupPostService {
  constructor(private readonly db: DatabaseClient) {}

  async listPosts(
    viewer: User,
    groupId: string,
    query: GroupCursorListQuery,
  ): Promise<{ posts: GroupPostDto[]; nextCursor: string | null }> {
    assertGroupAccess(viewer);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));

    const limit = Math.min(query.limit ?? GROUP_LIST_DEFAULT_LIMIT, GROUP_LIST_MAX_LIMIT);
    let cursor: { pinned: number; createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeGroupPinnedCursor(query.cursor);
      cursor = { pinned: decoded.pinned, createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const rows = await this.db.communityPost.findMany({
      where: {
        groupId,
        moderation: "VISIBLE",
        ...(cursor
          ? {
              OR: [
                { pinnedAt: cursor.pinned === 1 ? null : { not: null } },
                {
                  AND: [
                    cursor.pinned === 1 ? { pinnedAt: { not: null } } : { pinnedAt: null },
                    {
                      OR: [
                        { createdAt: { lt: cursor.createdAt } },
                        { AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }] },
                      ],
                    },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [
        { pinnedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit + 1,
      include: {
        author: { select: membershipUserSelect },
        _count: {
          select: {
            likes: true,
            comments: { where: { removedAt: null } },
          },
        },
        likes: { where: { userId: viewer.id }, select: { userId: true } },
      },
    });

    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const page = rows.slice(0, limit);
    const posts: GroupPostDto[] = [];
    for (const row of page) {
      const blocked = await isBlockedEitherDirection(this.db, viewer.id, row.authorId);
      if (blocked) {
        continue;
      }
      posts.push({
        postId: row.id,
        groupId: row.groupId,
        author: toGroupUserPreview(
          viewerSnapshot,
          toDiscoverUserSnapshot(row.author),
          row.author.profile,
          false,
        ),
        body: row.body,
        activityId: row.activityId,
        pinned: row.pinnedAt !== null,
        likeCount: row._count.likes,
        commentCount: row._count.comments,
        likedByMe: row.likes.length > 0,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      });
    }
    const last = page[page.length - 1];
    return {
      posts,
      nextCursor:
        rows.length > limit && last
          ? encodeGroupPinnedCursor({
              pinned: last.pinnedAt ? 1 : 0,
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async createPost(
    viewer: User,
    groupId: string,
    input: CreateGroupPostInput,
  ): Promise<GroupPostDto> {
    assertGroupAccess(viewer);
    const membership = requireActiveMember(await loadMembership(this.db, groupId, viewer.id));
    const group = await this.db.communityGroup.findUnique({
      where: { id: groupId },
      select: { status: true },
    });
    if (!group || group.status !== "ACTIVE") {
      throw groupForbidden("This group is not accepting posts");
    }
    if (input.activityId) {
      const linked = await this.db.communityGroupActivity.findUnique({
        where: { groupId_activityId: { groupId, activityId: input.activityId } },
      });
      if (!linked) {
        throw groupNotFound();
      }
    }
    void membership;
    const row = await this.db.communityPost.create({
      data: {
        groupId,
        authorId: viewer.id,
        body: input.body,
        activityId: input.activityId ?? null,
      },
      include: {
        author: { select: membershipUserSelect },
        _count: { select: { likes: true, comments: { where: { removedAt: null } } } },
      },
    });
    return {
      postId: row.id,
      groupId: row.groupId,
      author: toGroupUserPreview(
        toDiscoverUserSnapshot(viewer),
        toDiscoverUserSnapshot(row.author),
        row.author.profile,
        false,
      ),
      body: row.body,
      activityId: row.activityId,
      pinned: false,
      likeCount: 0,
      commentCount: 0,
      likedByMe: false,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async patchPost(
    viewer: User,
    groupId: string,
    postId: string,
    input: PatchGroupPostInput,
  ): Promise<GroupPostDto> {
    assertGroupAccess(viewer);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));
    const post = await this.requireVisiblePost(groupId, postId);
    if (post.authorId !== viewer.id) {
      throw groupNotFound();
    }
    const row = await this.db.communityPost.update({
      where: { id: postId },
      data: { body: input.body },
      include: {
        author: { select: membershipUserSelect },
        _count: { select: { likes: true, comments: { where: { removedAt: null } } } },
        likes: { where: { userId: viewer.id }, select: { userId: true } },
      },
    });
    return this.toPostDto(viewer, row);
  }

  async removePost(viewer: User, groupId: string, postId: string): Promise<{ removed: true }> {
    assertGroupAccess(viewer);
    const membership = requireActiveMember(await loadMembership(this.db, groupId, viewer.id));
    const post = await this.requireVisiblePost(groupId, postId);
    const isAuthor = post.authorId === viewer.id;
    if (!isAuthor) {
      assertCanModerateContent(membership.role);
    }
    await this.db.communityPost.update({
      where: { id: postId },
      data: {
        moderation: "REMOVED",
        removedAt: new Date(),
        removedById: viewer.id,
        pinnedAt: null,
        pinnedById: null,
      },
    });
    return { removed: true };
  }

  async pinPost(
    viewer: User,
    groupId: string,
    postId: string,
    input: PinGroupPostInput,
  ): Promise<GroupPostDto> {
    assertGroupAccess(viewer);
    const membership = requireActiveMember(await loadMembership(this.db, groupId, viewer.id));
    assertCanModerateContent(membership.role);
    const post = await this.requireVisiblePost(groupId, postId);
    void post;
    const row = await this.db.communityPost.update({
      where: { id: postId },
      data: input.pinned
        ? { pinnedAt: new Date(), pinnedById: viewer.id }
        : { pinnedAt: null, pinnedById: null },
      include: {
        author: { select: membershipUserSelect },
        _count: { select: { likes: true, comments: { where: { removedAt: null } } } },
        likes: { where: { userId: viewer.id }, select: { userId: true } },
      },
    });
    return this.toPostDto(viewer, row);
  }

  async listComments(
    viewer: User,
    groupId: string,
    postId: string,
    query: GroupCursorListQuery,
  ): Promise<{ comments: GroupCommentDto[]; nextCursor: string | null }> {
    assertGroupAccess(viewer);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));
    const post = await this.requireVisiblePost(groupId, postId);
    if (await isBlockedEitherDirection(this.db, viewer.id, post.authorId)) {
      throw groupNotFound();
    }

    const limit = Math.min(query.limit ?? GROUP_LIST_DEFAULT_LIMIT, GROUP_LIST_MAX_LIMIT);
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeGroupCreatedCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const rows = await this.db.communityPostComment.findMany({
      where: {
        postId,
        removedAt: null,
        ...(cursor
          ? {
              OR: [
                { createdAt: { gt: cursor.createdAt } },
                { AND: [{ createdAt: cursor.createdAt }, { id: { gt: cursor.id } }] },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      include: { author: { select: membershipUserSelect } },
    });

    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const page = rows.slice(0, limit);
    const comments: GroupCommentDto[] = [];
    for (const row of page) {
      const blocked = await isBlockedEitherDirection(this.db, viewer.id, row.authorId);
      if (blocked) {
        continue;
      }
      comments.push({
        commentId: row.id,
        postId: row.postId,
        author: toGroupUserPreview(
          viewerSnapshot,
          toDiscoverUserSnapshot(row.author),
          row.author.profile,
          false,
        ),
        body: row.body,
        createdAt: row.createdAt.toISOString(),
      });
    }
    const last = page[page.length - 1];
    return {
      comments,
      nextCursor:
        rows.length > limit && last
          ? encodeGroupCreatedCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }

  async createComment(
    viewer: User,
    groupId: string,
    postId: string,
    input: CreateGroupCommentInput,
  ): Promise<GroupCommentDto> {
    assertGroupAccess(viewer);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));
    const post = await this.requireVisiblePost(groupId, postId);
    if (await isBlockedEitherDirection(this.db, viewer.id, post.authorId)) {
      throw groupNotFound();
    }
    const group = await this.db.communityGroup.findUnique({
      where: { id: groupId },
      select: { status: true },
    });
    if (!group || group.status !== "ACTIVE") {
      throw groupForbidden("This group is not accepting comments");
    }
    const row = await this.db.communityPostComment.create({
      data: {
        postId,
        authorId: viewer.id,
        body: input.body,
      },
      include: { author: { select: membershipUserSelect } },
    });
    return {
      commentId: row.id,
      postId: row.postId,
      author: toGroupUserPreview(
        toDiscoverUserSnapshot(viewer),
        toDiscoverUserSnapshot(row.author),
        row.author.profile,
        false,
      ),
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async removeComment(
    viewer: User,
    groupId: string,
    postId: string,
    commentId: string,
  ): Promise<{ removed: true }> {
    assertGroupAccess(viewer);
    const membership = requireActiveMember(await loadMembership(this.db, groupId, viewer.id));
    await this.requireVisiblePost(groupId, postId);
    const comment = await this.db.communityPostComment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.postId !== postId || comment.removedAt) {
      throw groupNotFound();
    }
    if (comment.authorId !== viewer.id) {
      assertCanModerateContent(membership.role);
    }
    await this.db.communityPostComment.update({
      where: { id: commentId },
      data: { removedAt: new Date(), removedById: viewer.id },
    });
    return { removed: true };
  }

  async like(viewer: User, groupId: string, postId: string): Promise<{ liked: true }> {
    assertGroupAccess(viewer);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));
    const post = await this.requireVisiblePost(groupId, postId);
    if (await isBlockedEitherDirection(this.db, viewer.id, post.authorId)) {
      throw groupNotFound();
    }
    try {
      await this.db.communityPostLike.create({
        data: { postId, userId: viewer.id },
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
        throw err;
      }
    }
    return { liked: true };
  }

  async unlike(viewer: User, groupId: string, postId: string): Promise<{ liked: false }> {
    assertGroupAccess(viewer);
    requireActiveMember(await loadMembership(this.db, groupId, viewer.id));
    await this.requireVisiblePost(groupId, postId);
    await this.db.communityPostLike.deleteMany({
      where: { postId, userId: viewer.id },
    });
    return { liked: false };
  }

  private async requireVisiblePost(groupId: string, postId: string) {
    const post = await this.db.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post || post.groupId !== groupId || post.moderation !== "VISIBLE") {
      throw groupNotFound();
    }
    return post;
  }

  private toPostDto(
    viewer: User,
    row: {
      id: string;
      groupId: string;
      authorId: string;
      body: string;
      activityId: string | null;
      pinnedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      author: {
        id: string;
        accountStatus: User["accountStatus"];
        emailVerifiedAt: Date | null;
        ageEligibilityStatus: User["ageEligibilityStatus"];
        suspendedAt: Date | null;
        deletedAt: Date | null;
        identityVerificationStatus: User["identityVerificationStatus"];
        profile: {
          displayName: string | null;
          username: string | null;
          avatarStorageKey: string | null;
          locationCity: string | null;
          locationRegion: string | null;
          profileVisibility: "EVERYONE" | "VERIFIED_USERS_ONLY";
        } | null;
      };
      _count: { likes: number; comments: number };
      likes: { userId: string }[];
    },
  ): GroupPostDto {
    return {
      postId: row.id,
      groupId: row.groupId,
      author: toGroupUserPreview(
        toDiscoverUserSnapshot(viewer),
        toDiscoverUserSnapshot(row.author),
        row.author.profile,
        false,
      ),
      body: row.body,
      activityId: row.activityId,
      pinned: row.pinnedAt !== null,
      likeCount: row._count.likes,
      commentCount: row._count.comments,
      likedByMe: row.likes.length > 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
