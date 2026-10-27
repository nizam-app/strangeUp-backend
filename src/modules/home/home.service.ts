import type { User } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { ActivityService } from "../activities/activity.service.js";
import { createAppMediaStorages } from "../../infrastructure/media-storage/create-media-storages.js";
import { DiscoveryService } from "../discovery/discovery.service.js";
import { GroupService } from "../groups/group.service.js";
import type { AppEnv } from "../../config/env.js";
import { NotificationService } from "../notifications/notification.service.js";
import { CommunityFeedService } from "./community-feed.service.js";
import {
  HOME_ACTIVITIES_LIMIT,
  HOME_FEATURED_ACTIVITIES_LIMIT,
  HOME_FEATURED_GROUPS_LIMIT,
  HOME_FEED_PREVIEW_LIMIT,
  HOME_MY_GROUPS_LIMIT,
  HOME_PEOPLE_LIMIT,
  HOME_UPCOMING_GROUP_ACTIVITIES_LIMIT,
} from "./home.constants.js";
import type { CommunityFeedItemDto } from "./community-feed.service.js";
import type { GroupSummaryDto, MyGroupDto } from "../groups/group.dto.js";
import type { PublicActivityCardDto } from "../activities/activity.dto.js";
import type { PublicProfilePreviewDto } from "../discovery/public-profile.dto.js";
import { assertGroupAccess } from "../groups/group-access.js";
import {
  activityPublicSelect,
  hostPreviewForViewer,
  toPublicActivitySource,
} from "../activities/activity-mapper.js";
import { isDiscoverableStatus } from "../activities/activity-policy.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { toPublicActivityCard } from "../activities/activity.dto.js";

export type HomeDashboardDto = {
  myGroups: MyGroupDto[];
  communityFeedPreview: CommunityFeedItemDto[];
  upcomingGroupActivities: PublicActivityCardDto[];
  people: PublicProfilePreviewDto[];
  activities: PublicActivityCardDto[];
  featured: {
    groups: GroupSummaryDto[];
    activities: PublicActivityCardDto[];
  };
  notificationsUnreadCount: number;
  stories: { status: "DEFERRED"; reason: string };
};

export class HomeService {
  private readonly groupService: GroupService;
  private readonly activityService: ActivityService;
  private readonly discoveryService: DiscoveryService;
  private readonly communityFeedService: CommunityFeedService;
  private readonly notificationService: NotificationService;

  constructor(
    private readonly db: DatabaseClient,
    env: AppEnv,
  ) {
    const kyc = {
      isProduction: env.isProduction,
      kycProviderEnabled: env.KYC_PROVIDER_ENABLED,
    };
    const mediaStorages = createAppMediaStorages(env);
    this.groupService = new GroupService(db, mediaStorages.groupCover);
    this.activityService = new ActivityService(db, mediaStorages.activityCover, kyc);
    this.discoveryService = new DiscoveryService(db);
    this.communityFeedService = new CommunityFeedService(db, env);
    this.notificationService = new NotificationService(db);
  }

  async getDashboard(viewer: User): Promise<HomeDashboardDto> {
    assertGroupAccess(viewer);

    const [
      myGroupsResult,
      feedPreview,
      upcomingGroupActivities,
      peopleResult,
      activitiesResult,
      featuredGroups,
      featuredActivities,
      notificationsUnreadCount,
    ] = await Promise.all([
      this.groupService.listMine(viewer, { limit: HOME_MY_GROUPS_LIMIT, status: "ACTIVE" }),
      this.communityFeedService.list(viewer, { limit: HOME_FEED_PREVIEW_LIMIT }),
      this.loadUpcomingGroupActivities(viewer),
      this.discoveryService.listDiscoverablePeople(viewer, { limit: HOME_PEOPLE_LIMIT }),
      this.activityService.listDiscoverable(viewer, { limit: HOME_ACTIVITIES_LIMIT }),
      this.groupService.listDiscoverable(viewer, { limit: HOME_FEATURED_GROUPS_LIMIT }),
      this.activityService.listDiscoverable(viewer, { limit: HOME_FEATURED_ACTIVITIES_LIMIT }),
      this.notificationService.countUnread(viewer),
    ]);

    return {
      myGroups: myGroupsResult.groups,
      communityFeedPreview: feedPreview.items,
      upcomingGroupActivities,
      people: peopleResult.people,
      activities: activitiesResult.activities,
      featured: {
        groups: featuredGroups.groups,
        activities: featuredActivities.activities,
      },
      notificationsUnreadCount,
      stories: {
        status: "DEFERRED",
        reason:
          "24h community stories require owner-approved audience, retention, moderation, and media pipeline (D-06 provisional).",
      },
    };
  }

  private async loadUpcomingGroupActivities(viewer: User): Promise<PublicActivityCardDto[]> {
    const memberships = await this.db.communityMembership.findMany({
      where: { userId: viewer.id, status: "ACTIVE", group: { status: "ACTIVE" } },
      select: { groupId: true },
    });
    const groupIds = memberships.map((m) => m.groupId);
    if (groupIds.length === 0) {
      return [];
    }

    const now = new Date();
    const links = await this.db.communityGroupActivity.findMany({
      where: {
        groupId: { in: groupIds },
        activity: {
          status: "PUBLISHED",
          audience: "PUBLIC",
          startsAt: { gte: now },
        },
      },
      orderBy: [{ activity: { startsAt: "asc" } }, { activityId: "asc" }],
      take: HOME_UPCOMING_GROUP_ACTIVITIES_LIMIT * 2,
      include: { activity: { select: activityPublicSelect } },
    });

    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const cards: PublicActivityCardDto[] = [];
    const seen = new Set<string>();

    for (const link of links) {
      if (cards.length >= HOME_UPCOMING_GROUP_ACTIVITIES_LIMIT) {
        break;
      }
      const activity = link.activity;
      if (!isDiscoverableStatus(activity.status) || seen.has(activity.id)) {
        continue;
      }
      const member = await this.db.communityMembership.findUnique({
        where: { groupId_userId: { groupId: link.groupId, userId: viewer.id } },
        select: { status: true },
      });
      if (member?.status !== "ACTIVE") {
        continue;
      }
      const blocked = await isBlockedEitherDirection(this.db, viewer.id, activity.hostId);
      if (blocked) {
        continue;
      }
      seen.add(activity.id);
      const confirmedCount = await this.db.activityParticipation.count({
        where: { activityId: activity.id, state: "CONFIRMED" },
      });
      const source = toPublicActivitySource(activity, confirmedCount);
      const hostPreview = hostPreviewForViewer(viewerSnapshot, activity, false);
      cards.push(toPublicActivityCard(source, hostPreview));
    }

    return cards;
  }
}
