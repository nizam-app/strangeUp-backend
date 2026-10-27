import { Prisma, type User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { decodeSocialCreatedCursor, encodeSocialCreatedCursor } from "./social-cursor.js";
import { assertFullAccess, loadVisibleSocialTarget } from "./social-access.js";
import { SOCIAL_LIST_DEFAULT_LIMIT, SOCIAL_LIST_MAX_LIMIT } from "./social.constants.js";
import {
  toSocialUserPreview,
  type FollowStateDto,
  type SocialUserPreviewDto,
} from "./social.dto.js";
import type { SocialListQuery } from "./social.validation.js";

export class FollowService {
  constructor(private readonly db: DatabaseClient) {}

  async follow(viewer: User, targetUserId: string): Promise<FollowStateDto> {
    await loadVisibleSocialTarget(this.db, viewer, targetUserId);
    try {
      await this.db.userFollow.create({
        data: { followerId: viewer.id, followingId: targetUserId },
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
        throw err;
      }
    }
    return { following: true, targetUserId };
  }

  async unfollow(viewer: User, targetUserId: string): Promise<FollowStateDto> {
    assertFullAccess(viewer);
    if (viewer.id === targetUserId) {
      throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
    }
    await this.db.userFollow.deleteMany({
      where: { followerId: viewer.id, followingId: targetUserId },
    });
    return { following: false, targetUserId };
  }

  async listFollowing(viewer: User, query: SocialListQuery) {
    return this.listGraph(viewer, "following", query);
  }

  async listFollowers(viewer: User, query: SocialListQuery) {
    return this.listGraph(viewer, "followers", query);
  }

  private async listGraph(
    viewer: User,
    direction: "following" | "followers",
    query: SocialListQuery,
  ): Promise<{ people: SocialUserPreviewDto[]; nextCursor: string | null }> {
    assertFullAccess(viewer);
    const limit = Math.min(query.limit ?? SOCIAL_LIST_DEFAULT_LIMIT, SOCIAL_LIST_MAX_LIMIT);
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeSocialCreatedCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const where =
      direction === "following"
        ? {
            followerId: viewer.id,
            ...(cursor
              ? {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { AND: [{ createdAt: cursor.createdAt }, { followingId: { lt: cursor.id } }] },
                  ],
                }
              : {}),
          }
        : {
            followingId: viewer.id,
            ...(cursor
              ? {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { AND: [{ createdAt: cursor.createdAt }, { followerId: { lt: cursor.id } }] },
                  ],
                }
              : {}),
          };

    const rows = await this.db.userFollow.findMany({
      where,
      orderBy: [
        { createdAt: "desc" },
        direction === "following" ? { followingId: "desc" } : { followerId: "desc" },
      ],
      take: limit + 1,
      include: {
        following: {
          select: {
            id: true,
            accountStatus: true,
            emailVerifiedAt: true,
            ageEligibilityStatus: true,
            suspendedAt: true,
            deletedAt: true,
            identityVerificationStatus: true,
            profile: {
              select: {
                displayName: true,
                username: true,
                avatarStorageKey: true,
                locationCity: true,
                locationRegion: true,
                profileVisibility: true,
              },
            },
          },
        },
        follower: {
          select: {
            id: true,
            accountStatus: true,
            emailVerifiedAt: true,
            ageEligibilityStatus: true,
            suspendedAt: true,
            deletedAt: true,
            identityVerificationStatus: true,
            profile: {
              select: {
                displayName: true,
                username: true,
                avatarStorageKey: true,
                locationCity: true,
                locationRegion: true,
                profileVisibility: true,
              },
            },
          },
        },
      },
    });

    const page = rows.slice(0, limit);
    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const people: SocialUserPreviewDto[] = [];
    for (const row of page) {
      const other = direction === "following" ? row.following : row.follower;
      const blocked = await isBlockedEitherDirection(this.db, viewer.id, other.id);
      if (blocked) {
        continue;
      }
      people.push(
        toSocialUserPreview(viewerSnapshot, toDiscoverUserSnapshot(other), other.profile, false),
      );
    }

    const last = page[page.length - 1];
    const nextCursor =
      rows.length > limit && last
        ? encodeSocialCreatedCursor({
            createdAt: last.createdAt.toISOString(),
            id: direction === "following" ? last.followingId : last.followerId,
          })
        : null;

    return { people, nextCursor };
  }
}
