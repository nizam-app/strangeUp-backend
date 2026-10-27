import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { enrichGroupPostDto } from "../group-content/group-post-enrichment.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import {
  activityPublicSelect,
  hostPreviewForViewer,
  toPublicActivitySource,
} from "../activities/activity-mapper.js";
import { isDiscoverableStatus } from "../activities/activity-policy.js";
import { toPublicActivityCard, type PublicActivityCardDto } from "../activities/activity.dto.js";
import { assertGroupAccess, membershipUserSelect } from "../groups/group-access.js";
import { toGroupUserPreview, type GroupPostDto } from "../groups/group.dto.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { COMMUNITY_FEED_DEFAULT_LIMIT, COMMUNITY_FEED_MAX_LIMIT } from "./home.constants.js";
import { decodeCommunityFeedCursor, encodeCommunityFeedCursor } from "./community-feed-cursor.js";
import type { CommunityFeedQuery } from "./home.validation.js";

export type CommunityFeedItemDto = GroupPostDto & {
  groupName: string;
  linkedActivity: PublicActivityCardDto | null;
};

export class CommunityFeedService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly env: AppEnv,
  ) {}

  async list(
    viewer: User,
    query: CommunityFeedQuery,
  ): Promise<{ items: CommunityFeedItemDto[]; nextCursor: string | null }> {
    assertGroupAccess(viewer);

    const memberships = await this.db.communityMembership.findMany({
      where: { userId: viewer.id, status: "ACTIVE" },
      select: { groupId: true, group: { select: { id: true, name: true, status: true } } },
    });

    let eligibleGroupIds = memberships
      .filter((m) => m.group.status === "ACTIVE")
      .map((m) => m.groupId);

    if (query.groupId) {
      if (!eligibleGroupIds.includes(query.groupId)) {
        throw new AppError("NOT_FOUND", "Group not found", 404);
      }
      eligibleGroupIds = [query.groupId];
    }

    if (eligibleGroupIds.length === 0) {
      return { items: [], nextCursor: null };
    }

    const limit = Math.min(query.limit ?? COMMUNITY_FEED_DEFAULT_LIMIT, COMMUNITY_FEED_MAX_LIMIT);
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeCommunityFeedCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const rows = await this.db.communityPost.findMany({
      where: {
        groupId: { in: eligibleGroupIds },
        moderation: "VISIBLE",
        group: { status: "ACTIVE" },
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }] },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        group: { select: { name: true } },
        author: { select: membershipUserSelect },
        activity: { select: activityPublicSelect },
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
    const items: CommunityFeedItemDto[] = [];

    for (const row of page) {
      const stillMember = await this.db.communityMembership.findUnique({
        where: { groupId_userId: { groupId: row.groupId, userId: viewer.id } },
        select: { status: true },
      });
      if (stillMember?.status !== "ACTIVE") {
        continue;
      }
      const blocked = await isBlockedEitherDirection(this.db, viewer.id, row.authorId);
      if (blocked) {
        continue;
      }

      let linkedActivity: PublicActivityCardDto | null = null;
      if (row.activityId && row.activity) {
        const activity = row.activity;
        if (
          isDiscoverableStatus(activity.status) &&
          activity.audience === "PUBLIC" &&
          !(await isBlockedEitherDirection(this.db, viewer.id, activity.hostId))
        ) {
          const confirmedCount = await this.db.activityParticipation.count({
            where: { activityId: activity.id, state: "CONFIRMED" },
          });
          const source = toPublicActivitySource(activity, confirmedCount);
          const hostPreview = hostPreviewForViewer(viewerSnapshot, activity, false);
          linkedActivity = toPublicActivityCard(source, hostPreview);
        }
      }

      const base = {
        postId: row.id,
        groupId: row.groupId,
        groupName: row.group.name,
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
        photo: null,
        poll: null,
        linkedActivity,
      };
      const enriched = await enrichGroupPostDto(this.db, this.env, viewer.id, base);
      items.push({ ...enriched, groupName: base.groupName, linkedActivity });
    }

    const last = page[page.length - 1];
    return {
      items,
      nextCursor:
        rows.length > limit && last
          ? encodeCommunityFeedCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
          : null,
    };
  }
}
