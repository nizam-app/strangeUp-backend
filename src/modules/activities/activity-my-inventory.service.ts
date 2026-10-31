import type { ActivityParticipationState, User } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { hasFullAccountAccess, toPolicyActor } from "../policy/account-policy.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { decodeActivityStartsCursor, encodeActivityStartsCursor } from "./activity-cursor.js";
import { activityForbidden } from "./activity-errors.js";
import {
  activityPublicSelect,
  hostPreviewForViewer,
  toPublicActivitySource,
} from "./activity-mapper.js";
import { canBrowseActivities } from "./activity-policy.js";
import { ACTIVITY_LIST_DEFAULT_LIMIT, ACTIVITY_LIST_MAX_LIMIT } from "./activity.constants.js";
import {
  compareInventoryAsc,
  compareInventoryDesc,
  participantInventoryActivityWhere,
  rowAfterCursor,
  type ActivityWhenFilter,
  type InventorySortRow,
  isHostInventoryEligibleStatus,
  activityStartsAtWhere,
  type MyActivityInventoryView,
} from "./activity-my-inventory.policy.js";
import {
  toMyParticipationDto,
  toPublicActivityCard,
  type MyActivityInventoryItemDto,
} from "./activity.dto.js";
import type { MyActivityInventoryQuery } from "./activity.validation.js";

const INVENTORY_FETCH_CAP = 200;

type HostInventoryRecord = Awaited<
  ReturnType<ActivityMyInventoryService["loadHostRecords"]>
>[number];
type ParticipantInventoryRecord = Awaited<
  ReturnType<ActivityMyInventoryService["loadParticipantRecords"]>
>[number];

export class ActivityMyInventoryService {
  constructor(private readonly db: DatabaseClient) {}

  async list(viewer: User, query: MyActivityInventoryQuery) {
    this.assertBrowse(viewer);
    const now = new Date();
    const limit = Math.min(query.limit ?? ACTIVITY_LIST_DEFAULT_LIMIT, ACTIVITY_LIST_MAX_LIMIT);
    const cursor = query.cursor ? decodeActivityStartsCursor(query.cursor) : null;
    const cursorRow: InventorySortRow | null = cursor
      ? { activityId: cursor.id, startsAt: new Date(cursor.startsAt) }
      : null;

    const { items, hasMore } = await this.listForView(viewer, query.view, limit, cursorRow, now);
    const counts = query.includeCounts ? await this.counts(viewer.id, now) : undefined;

    const nextCursor =
      hasMore && items.length > 0
        ? encodeActivityStartsCursor({
            startsAt: items[items.length - 1].activity.startsAt,
            id: items[items.length - 1].activity.activityId,
          })
        : null;

    return { items, counts, nextCursor };
  }

  private async listForView(
    viewer: User,
    view: MyActivityInventoryView,
    limit: number,
    cursor: InventorySortRow | null,
    now: Date,
  ): Promise<{ items: MyActivityInventoryItemDto[]; hasMore: boolean }> {
    switch (view) {
      case "hosting": {
        const records = await this.loadHostRecords(viewer.id, "upcoming", now);
        return this.pageHost(viewer, records, limit, cursor, compareInventoryAsc);
      }
      case "joined": {
        const records = await this.loadParticipantRecords(viewer.id, "CONFIRMED", "upcoming", now);
        return this.pageParticipant(viewer, records, limit, cursor, compareInventoryAsc);
      }
      case "waitlisted": {
        const records = await this.loadParticipantRecords(viewer.id, "WAITLISTED", "upcoming", now);
        return this.pageParticipant(viewer, records, limit, cursor, compareInventoryAsc);
      }
      case "pending": {
        const records = await this.loadParticipantRecords(viewer.id, "PENDING", "upcoming", now);
        return this.pageParticipant(viewer, records, limit, cursor, compareInventoryAsc);
      }
      case "upcoming": {
        const [hostRecords, joinedRecords] = await Promise.all([
          this.loadHostRecords(viewer.id, "upcoming", now),
          this.loadParticipantRecords(viewer.id, "CONFIRMED", "upcoming", now),
        ]);
        return this.pageMixed(
          viewer,
          hostRecords,
          joinedRecords,
          limit,
          cursor,
          compareInventoryAsc,
        );
      }
      case "past": {
        const [hostRecords, participantRecords] = await Promise.all([
          this.loadHostRecords(viewer.id, "past", now),
          this.loadParticipantRecords(viewer.id, "both", "past", now),
        ]);
        return this.pageMixed(
          viewer,
          hostRecords,
          participantRecords,
          limit,
          cursor,
          compareInventoryDesc,
        );
      }
      default: {
        const _exhaustive: never = view;
        return _exhaustive;
      }
    }
  }

  private async loadHostRecords(hostId: string, when: ActivityWhenFilter, now: Date) {
    const rows = await this.db.activity.findMany({
      where: {
        hostId,
        ...activityStartsAtWhere(when, now),
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: INVENTORY_FETCH_CAP,
      select: {
        ...activityPublicSelect,
        _count: {
          select: {
            participations: { where: { state: "CONFIRMED" } },
          },
        },
        participations: {
          where: { state: "WAITLISTED" },
          select: { id: true },
        },
      },
    });
    return rows.filter((row) => isHostInventoryEligibleStatus(row.status));
  }

  private async loadParticipantRecords(
    userId: string,
    participation: "CONFIRMED" | "WAITLISTED" | "PENDING" | "both",
    when: ActivityWhenFilter,
    now: Date,
  ) {
    const stateFilter: { in: ActivityParticipationState[] } | ActivityParticipationState =
      participation === "both" ? { in: ["CONFIRMED", "WAITLISTED"] } : participation;

    return this.db.activityParticipation.findMany({
      where: {
        userId,
        state: stateFilter,
        activity: {
          ...participantInventoryActivityWhere,
          ...activityStartsAtWhere(when, now),
        },
      },
      orderBy: [{ activity: { startsAt: "asc" } }, { activity: { id: "asc" } }],
      take: INVENTORY_FETCH_CAP,
      include: {
        activity: {
          select: {
            ...activityPublicSelect,
            _count: { select: { participations: { where: { state: "CONFIRMED" } } } },
          },
        },
      },
    });
  }

  private sliceInventory<T extends InventorySortRow>(
    rows: T[],
    limit: number,
    cursor: InventorySortRow | null,
    compare: (a: InventorySortRow, b: InventorySortRow) => number,
    ascending: boolean,
  ): { slice: T[]; hasMore: boolean } {
    const sorted = [...rows].sort((a, b) =>
      compare(
        { activityId: a.activityId, startsAt: a.startsAt },
        { activityId: b.activityId, startsAt: b.startsAt },
      ),
    );
    const afterCursor = cursor
      ? sorted.filter((row) =>
          rowAfterCursor({ activityId: row.activityId, startsAt: row.startsAt }, cursor, ascending),
        )
      : sorted;
    const page = afterCursor.slice(0, limit + 1);
    return { slice: page.slice(0, limit), hasMore: page.length > limit };
  }

  private pageHost(
    viewer: User,
    records: HostInventoryRecord[],
    limit: number,
    cursor: InventorySortRow | null,
    compare: (a: InventorySortRow, b: InventorySortRow) => number,
  ) {
    const normalized = records.map((row) => ({
      activityId: row.id,
      startsAt: row.startsAt,
      record: row,
    }));
    const { slice, hasMore } = this.sliceInventory(normalized, limit, cursor, compare, true);
    const items = this.toHostItems(
      viewer,
      slice.map((entry) => entry.record),
    );
    return { items, hasMore };
  }

  private async pageParticipant(
    viewer: User,
    records: ParticipantInventoryRecord[],
    limit: number,
    cursor: InventorySortRow | null,
    compare: (a: InventorySortRow, b: InventorySortRow) => number,
  ) {
    const normalized = records.map((row) => ({
      activityId: row.activity.id,
      startsAt: row.activity.startsAt,
      record: row,
    }));
    const { slice, hasMore } = this.sliceInventory(normalized, limit, cursor, compare, true);
    const items = await this.toParticipantItems(
      viewer,
      slice.map((entry) => entry.record),
    );
    return { items, hasMore };
  }

  private async pageMixed(
    viewer: User,
    hostRecords: HostInventoryRecord[],
    participantRecords: ParticipantInventoryRecord[],
    limit: number,
    cursor: InventorySortRow | null,
    compare: (a: InventorySortRow, b: InventorySortRow) => number,
  ) {
    const ascending = compare === compareInventoryAsc;
    type Slot = {
      activityId: string;
      startsAt: Date;
      kind: "host" | "participant";
      host?: HostInventoryRecord;
      participant?: ParticipantInventoryRecord;
    };
    const slots: Slot[] = [];
    const seen = new Set<string>();
    for (const row of hostRecords) {
      if (seen.has(row.id)) {
        continue;
      }
      seen.add(row.id);
      slots.push({
        activityId: row.id,
        startsAt: row.startsAt,
        kind: "host",
        host: row,
      });
    }
    for (const row of participantRecords) {
      if (seen.has(row.activity.id)) {
        continue;
      }
      seen.add(row.activity.id);
      slots.push({
        activityId: row.activity.id,
        startsAt: row.activity.startsAt,
        kind: "participant",
        participant: row,
      });
    }

    const { slice, hasMore } = this.sliceInventory(slots, limit, cursor, compare, ascending);
    const items: MyActivityInventoryItemDto[] = [];
    for (const slot of slice) {
      if (slot.kind === "host" && slot.host) {
        items.push(...this.toHostItems(viewer, [slot.host]));
      } else if (slot.participant) {
        items.push(...(await this.toParticipantItems(viewer, [slot.participant])));
      }
    }
    return { items, hasMore };
  }

  private toHostItems(viewer: User, rows: HostInventoryRecord[]): MyActivityInventoryItemDto[] {
    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    return rows.map((row) => {
      const source = toPublicActivitySource(row, row._count.participations);
      const hostPreview = hostPreviewForViewer(viewerSnapshot, row, false);
      return {
        relationship: "HOSTING" as const,
        activity: toPublicActivityCard(source, hostPreview),
        myParticipation: null,
        hostWaitlistedCount: row.participations.length,
      };
    });
  }

  private async toParticipantItems(
    viewer: User,
    rows: ParticipantInventoryRecord[],
  ): Promise<MyActivityInventoryItemDto[]> {
    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const items: MyActivityInventoryItemDto[] = [];
    for (const participation of rows) {
      const myParticipation = toMyParticipationDto(participation, participation.activity.joinMode);
      if (!myParticipation) {
        continue;
      }
      const blocked = await isBlockedEitherDirection(
        this.db,
        viewer.id,
        participation.activity.hostId,
      );
      const source = toPublicActivitySource(
        participation.activity,
        participation.activity._count.participations,
      );
      const hostPreview = hostPreviewForViewer(viewerSnapshot, participation.activity, blocked);
      const relationship =
        myParticipation.state === "PENDING"
          ? "PENDING_APPROVAL"
          : myParticipation.state === "WAITLISTED"
            ? "WAITLISTED"
            : "JOINED";
      items.push({
        relationship,
        activity: toPublicActivityCard(source, hostPreview),
        myParticipation,
        hostWaitlistedCount: null,
      });
    }
    return items;
  }

  async counts(userId: string, now: Date) {
    const [hosting, joined, waitlisted, pendingApproval] = await Promise.all([
      this.db.activity.count({
        where: {
          hostId: userId,
          ...activityStartsAtWhere("upcoming", now),
          status: { notIn: ["CANCELLED", "COMPLETED"] },
        },
      }),
      this.db.activityParticipation.count({
        where: {
          userId,
          state: "CONFIRMED",
          activity: {
            ...participantInventoryActivityWhere,
            ...activityStartsAtWhere("upcoming", now),
          },
        },
      }),
      this.db.activityParticipation.count({
        where: {
          userId,
          state: "WAITLISTED",
          activity: {
            ...participantInventoryActivityWhere,
            ...activityStartsAtWhere("upcoming", now),
          },
        },
      }),
      this.db.activityParticipation.count({
        where: {
          userId,
          state: "PENDING",
          activity: {
            ...participantInventoryActivityWhere,
            ...activityStartsAtWhere("upcoming", now),
          },
        },
      }),
    ]);
    return {
      upcoming: hosting + joined,
      hosting,
      joined,
      waitlisted,
      pendingApproval,
    };
  }

  private assertBrowse(viewer: User): void {
    if (!canBrowseActivities(toPolicyActor(viewer))) {
      throw activityForbidden("Complete onboarding to browse activities");
    }
    if (!hasFullAccountAccess(toPolicyActor(viewer))) {
      throw activityForbidden("Complete onboarding to browse activities");
    }
  }
}
