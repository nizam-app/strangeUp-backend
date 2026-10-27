import type { User } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { activityNotFound } from "../activities/activity-errors.js";
import {
  activityPublicSelect,
  hostPreviewForViewer,
  toPublicActivitySource,
} from "../activities/activity-mapper.js";
import { isDiscoverableStatus } from "../activities/activity-policy.js";
import { toPublicActivityCard } from "../activities/activity.dto.js";
import { assertSavedActivitiesAccess } from "./saved-activity-access.js";
import { decodeSavedActivityCursor, encodeSavedActivityCursor } from "./saved-activity-cursor.js";
import {
  SAVED_ACTIVITY_LIST_DEFAULT_LIMIT,
  SAVED_ACTIVITY_LIST_MAX_LIMIT,
  type SavedActivityListQuery,
} from "./saved-activity.validation.js";

export class SavedActivityService {
  constructor(private readonly db: DatabaseClient) {}

  async listSaved(viewer: User, query: SavedActivityListQuery) {
    assertSavedActivitiesAccess(viewer);
    const limit = Math.min(
      query.limit ?? SAVED_ACTIVITY_LIST_DEFAULT_LIMIT,
      SAVED_ACTIVITY_LIST_MAX_LIMIT,
    );
    const blockedHostIds = await this.blockedCounterpartIds(viewer.id);
    const cursor = query.cursor ? decodeSavedActivityCursor(query.cursor) : null;

    const saves = await this.db.savedActivity.findMany({
      where: {
        userId: viewer.id,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                {
                  createdAt: new Date(cursor.createdAt),
                  activityId: { lt: cursor.activityId },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { activityId: "desc" }],
      take: limit + 1,
      include: {
        activity: {
          select: {
            ...activityPublicSelect,
            _count: { select: { participations: { where: { state: "CONFIRMED" } } } },
          },
        },
      },
    });

    const page = saves.slice(0, limit);
    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const activities = [];

    for (const save of page) {
      const row = save.activity;
      if (!isDiscoverableStatus(row.status) || row.audience !== "PUBLIC" || row.cancelledAt) {
        continue;
      }
      if (blockedHostIds.includes(row.hostId)) {
        continue;
      }
      const source = toPublicActivitySource(row, row._count.participations);
      const hostPreview = hostPreviewForViewer(viewerSnapshot, row, false);
      activities.push({
        savedAt: save.createdAt.toISOString(),
        activity: toPublicActivityCard(source, hostPreview),
      });
    }

    const last = page.at(-1);
    const nextCursor =
      saves.length > limit && last
        ? encodeSavedActivityCursor({
            createdAt: last.createdAt.toISOString(),
            activityId: last.activityId,
          })
        : null;

    return { activities, nextCursor };
  }

  async saveActivity(viewer: User, activityId: string) {
    assertSavedActivitiesAccess(viewer);
    await this.assertSavableActivity(viewer, activityId);
    await this.db.savedActivity.upsert({
      where: { userId_activityId: { userId: viewer.id, activityId } },
      create: { userId: viewer.id, activityId },
      update: {},
    });
    return { activityId, saved: true };
  }

  async unsaveActivity(viewer: User, activityId: string) {
    assertSavedActivitiesAccess(viewer);
    await this.db.savedActivity.deleteMany({
      where: { userId: viewer.id, activityId },
    });
    return { activityId, saved: false };
  }

  async countSaved(userId: string): Promise<number> {
    return this.db.savedActivity.count({ where: { userId } });
  }

  private async assertSavableActivity(viewer: User, activityId: string): Promise<void> {
    const row = await this.db.activity.findUnique({
      where: { id: activityId },
      select: { id: true, hostId: true, status: true, audience: true, cancelledAt: true },
    });
    if (!row || !isDiscoverableStatus(row.status) || row.audience !== "PUBLIC" || row.cancelledAt) {
      throw activityNotFound();
    }
    const blocked = await isBlockedEitherDirection(this.db, viewer.id, row.hostId);
    if (blocked) {
      throw activityNotFound();
    }
  }

  private async blockedCounterpartIds(userId: string): Promise<string[]> {
    const rows = await this.db.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const ids = new Set<string>();
    for (const row of rows) {
      ids.add(row.blockerId === userId ? row.blockedId : row.blockerId);
    }
    return [...ids];
  }
}
