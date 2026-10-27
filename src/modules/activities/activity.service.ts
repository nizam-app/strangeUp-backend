import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { toPolicyActor } from "../policy/account-policy.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { decodeActivityStartsCursor, encodeActivityStartsCursor } from "./activity-cursor.js";
import { activityForbidden, activityKycRequired, activityNotFound } from "./activity-errors.js";
import { toKycTrustSnapshot } from "./activity-kyc.js";
import {
  activityPublicSelect,
  hostPreviewForViewer,
  toPublicActivitySource,
  type ActivityWithRelations,
} from "./activity-mapper.js";
import {
  canAccessMeetingDetails,
  canBrowseActivities,
  isDiscoverableStatus,
} from "./activity-policy.js";
import { buildDiscoverableActivitiesWhere } from "./activity-query.js";
import { ACTIVITY_LIST_DEFAULT_LIMIT, ACTIVITY_LIST_MAX_LIMIT } from "./activity.constants.js";
import {
  toActivityMeetingDto,
  toMyParticipationDto,
  toPublicActivityCard,
  toPublicActivityDetail,
} from "./activity.dto.js";
import type { ActivityListQuery } from "./activity.validation.js";
import type { ActivityCoverStorage } from "./activity-cover.storage.js";
import type { ActivityKycEnforcementContext } from "./activity-kyc.js";

export class ActivityService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly coverStorage: ActivityCoverStorage,
    private readonly kyc: ActivityKycEnforcementContext,
  ) {}

  async listCategories(viewer: User): Promise<{ categories: { slug: string; label: string }[] }> {
    this.assertBrowse(viewer);
    const rows = await this.db.activityCategory.findMany({
      orderBy: { sortOrder: "asc" },
      select: { slug: true, label: true },
    });
    return { categories: rows };
  }

  async listDiscoverable(viewer: User, query: ActivityListQuery) {
    this.assertBrowse(viewer);
    const limit = Math.min(query.limit ?? ACTIVITY_LIST_DEFAULT_LIMIT, ACTIVITY_LIST_MAX_LIMIT);
    const blockedHostIds = await this.blockedCounterpartIds(viewer.id);

    let cursor: { startsAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeActivityStartsCursor(query.cursor);
      cursor = { startsAt: new Date(decoded.startsAt), id: decoded.id };
    }

    const where = buildDiscoverableActivitiesWhere({
      now: new Date(),
      blockedHostIds,
      query,
      cursor,
    });

    const rows = await this.db.activity.findMany({
      where,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      select: {
        ...activityPublicSelect,
        _count: { select: { participations: { where: { state: "CONFIRMED" } } } },
      },
    });

    const page = rows.slice(0, limit);
    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const activities = page.map((row) => {
      const source = toPublicActivitySource(row, row._count.participations);
      const hostPreview = hostPreviewForViewer(viewerSnapshot, row, false);
      return toPublicActivityCard(source, hostPreview);
    });

    const nextCursor =
      rows.length > limit && page.length > 0
        ? encodeActivityStartsCursor({
            startsAt: page[page.length - 1].startsAt.toISOString(),
            id: page[page.length - 1].id,
          })
        : null;

    return { activities, nextCursor };
  }

  async getPublicDetail(viewer: User, activityId: string) {
    this.assertBrowse(viewer);
    const row = await this.loadVisiblePublished(viewer, activityId);
    const confirmedCount = await this.db.activityParticipation.count({
      where: { activityId, state: "CONFIRMED" },
    });
    const mine = await this.db.activityParticipation.findUnique({
      where: { activityId_userId: { activityId, userId: viewer.id } },
      select: { state: true, waitlistPosition: true },
    });
    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const blocked = await isBlockedEitherDirection(this.db, viewer.id, row.hostId);
    const source = toPublicActivitySource(row, confirmedCount);
    const hostPreview = hostPreviewForViewer(viewerSnapshot, row, blocked);
    const myParticipation = mine ? toMyParticipationDto(mine) : null;
    const meetingAvailable = canAccessMeetingDetails({
      isHost: viewer.id === row.hostId,
      participationState: mine?.state ?? null,
      activityStatus: row.status,
      mode: row.mode,
      kycTrust: toKycTrustSnapshot(viewer),
      accountEligible: canBrowseActivities(toPolicyActor(viewer)),
      blockedWithHost: blocked,
      kyc: this.kyc,
    });
    return toPublicActivityDetail(source, hostPreview, myParticipation, meetingAvailable);
  }

  async getMeeting(viewer: User, activityId: string) {
    this.assertBrowse(viewer);
    const row = await this.db.activity.findUnique({
      where: { id: activityId },
      select: activityPublicSelect,
    });
    if (!row) {
      throw activityNotFound();
    }

    const isHost = viewer.id === row.hostId;
    if (!isHost && !isDiscoverableStatus(row.status)) {
      throw activityNotFound();
    }

    const blocked = await isBlockedEitherDirection(this.db, viewer.id, row.hostId);
    if (blocked && !isHost) {
      throw activityNotFound();
    }

    const mine = await this.db.activityParticipation.findUnique({
      where: { activityId_userId: { activityId, userId: viewer.id } },
      select: { state: true },
    });

    const allowed = canAccessMeetingDetails({
      isHost,
      participationState: mine?.state ?? null,
      activityStatus: row.status,
      mode: row.mode,
      kycTrust: toKycTrustSnapshot(viewer),
      accountEligible: canBrowseActivities(toPolicyActor(viewer)),
      blockedWithHost: blocked,
      kyc: this.kyc,
    });
    if (!allowed) {
      if (mine?.state === "CONFIRMED") {
        throw activityKycRequired();
      }
      throw activityForbidden(
        "Meeting details are available only to the host or confirmed participants",
      );
    }

    return toActivityMeetingDto({
      activityId: row.id,
      venueName: row.venueName,
      meetingInstructions: row.meetingInstructions,
      virtualMeetingDetails: row.virtualMeetingDetails,
    });
  }

  async getPublicCoverBytes(
    viewer: User,
    activityId: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    this.assertBrowse(viewer);
    const row = await this.loadVisiblePublished(viewer, activityId);
    if (!row.coverStorageKey || !row.coverContentType) {
      throw activityNotFound();
    }
    const buffer = await this.coverStorage.readBytes(row.coverStorageKey, row.hostId);
    return { buffer, contentType: row.coverContentType };
  }

  private async loadVisiblePublished(
    viewer: User,
    activityId: string,
  ): Promise<ActivityWithRelations> {
    const row = await this.db.activity.findUnique({
      where: { id: activityId },
      select: activityPublicSelect,
    });
    if (!row || !isDiscoverableStatus(row.status) || row.audience !== "PUBLIC") {
      throw activityNotFound();
    }
    const blocked = await isBlockedEitherDirection(this.db, viewer.id, row.hostId);
    if (blocked) {
      throw activityNotFound();
    }
    return row;
  }

  private assertBrowse(viewer: User): void {
    if (!canBrowseActivities(toPolicyActor(viewer))) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Activities are not available in the current account state",
        403,
      );
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
