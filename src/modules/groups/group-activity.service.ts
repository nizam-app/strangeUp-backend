import type { User } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import {
  activityPublicSelect,
  hostPreviewForViewer,
  toPublicActivitySource,
} from "../activities/activity-mapper.js";
import { isDiscoverableStatus } from "../activities/activity-policy.js";
import { toPublicActivityCard, type PublicActivityCardDto } from "../activities/activity.dto.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { decodeGroupCreatedCursor, encodeGroupCreatedCursor } from "./group-cursor.js";
import { groupForbidden, groupNotFound } from "./group-errors.js";
import {
  assertGroupAccess,
  loadMembership,
  requireActiveMember,
  requireManager,
} from "./group-access.js";
import { GROUP_LIST_DEFAULT_LIMIT, GROUP_LIST_MAX_LIMIT } from "./group.constants.js";
import type { AttachGroupActivityInput, GroupCursorListQuery } from "./group.validation.js";

export class GroupActivityService {
  constructor(private readonly db: DatabaseClient) {}

  async list(
    viewer: User,
    groupId: string,
    query: GroupCursorListQuery,
  ): Promise<{ activities: PublicActivityCardDto[]; nextCursor: string | null }> {
    assertGroupAccess(viewer);
    const group = await this.db.communityGroup.findUnique({
      where: { id: groupId },
      select: { id: true, privacy: true, status: true },
    });
    if (!group) {
      throw groupNotFound();
    }
    const membership = await loadMembership(this.db, groupId, viewer.id);
    const isMember = membership?.status === "ACTIVE";
    if (group.privacy === "PRIVATE_APPROVAL" || group.status === "ARCHIVED") {
      requireActiveMember(membership);
    }

    const limit = Math.min(query.limit ?? GROUP_LIST_DEFAULT_LIMIT, GROUP_LIST_MAX_LIMIT);
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeGroupCreatedCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const links = await this.db.communityGroupActivity.findMany({
      where: {
        groupId,
        activity: {
          status: "PUBLISHED",
          audience: "PUBLIC",
        },
        ...(cursor
          ? {
              OR: [
                { attachedAt: { lt: cursor.createdAt } },
                { AND: [{ attachedAt: cursor.createdAt }, { activityId: { lt: cursor.id } }] },
              ],
            }
          : {}),
      },
      orderBy: [{ attachedAt: "desc" }, { activityId: "desc" }],
      take: limit + 1,
      include: {
        activity: { select: activityPublicSelect },
      },
    });

    void isMember;
    const page = links.slice(0, limit);
    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const activities: PublicActivityCardDto[] = [];
    for (const link of page) {
      const activity = link.activity;
      if (!isDiscoverableStatus(activity.status) || activity.audience !== "PUBLIC") {
        continue;
      }
      const blocked = await isBlockedEitherDirection(this.db, viewer.id, activity.hostId);
      if (blocked) {
        continue;
      }
      const confirmedCount = await this.db.activityParticipation.count({
        where: { activityId: activity.id, state: "CONFIRMED" },
      });
      const source = toPublicActivitySource(activity, confirmedCount);
      const hostPreview = hostPreviewForViewer(viewerSnapshot, activity, blocked);
      activities.push(toPublicActivityCard(source, hostPreview));
    }
    const last = page[page.length - 1];
    return {
      activities,
      nextCursor:
        links.length > limit && last
          ? encodeGroupCreatedCursor({
              createdAt: last.attachedAt.toISOString(),
              id: last.activityId,
            })
          : null,
    };
  }

  async attach(
    viewer: User,
    groupId: string,
    input: AttachGroupActivityInput,
  ): Promise<{ attached: true; activityId: string }> {
    assertGroupAccess(viewer);
    requireManager(await loadMembership(this.db, groupId, viewer.id));
    const group = await this.db.communityGroup.findUnique({
      where: { id: groupId },
      select: { status: true },
    });
    if (!group || group.status !== "ACTIVE") {
      throw groupForbidden("This group cannot accept activity links");
    }
    const activity = await this.db.activity.findUnique({
      where: { id: input.activityId },
      select: { id: true, hostId: true, status: true },
    });
    if (!activity || activity.hostId !== viewer.id) {
      throw groupNotFound();
    }
    if (activity.status === "CANCELLED") {
      throw groupForbidden("Cancelled activities cannot be linked");
    }
    await this.db.communityGroupActivity.upsert({
      where: { groupId_activityId: { groupId, activityId: activity.id } },
      create: {
        groupId,
        activityId: activity.id,
        attachedById: viewer.id,
      },
      update: {},
    });
    return { attached: true, activityId: activity.id };
  }

  async detach(viewer: User, groupId: string, activityId: string): Promise<{ detached: true }> {
    assertGroupAccess(viewer);
    requireManager(await loadMembership(this.db, groupId, viewer.id));
    const activity = await this.db.activity.findUnique({
      where: { id: activityId },
      select: { hostId: true },
    });
    if (!activity || activity.hostId !== viewer.id) {
      throw groupNotFound();
    }
    await this.db.communityGroupActivity.deleteMany({
      where: { groupId, activityId },
    });
    return { detached: true };
  }
}
