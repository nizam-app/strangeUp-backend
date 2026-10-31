import type { ActivityMode, User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { AVATAR_MAX_BYTES } from "../profile-media/avatar.constants.js";
import { processAvatarUpload } from "../profile-media/avatar-image-processor.js";
import { toPolicyActor } from "../policy/account-policy.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { decodeActivityCreatedCursor, encodeActivityCreatedCursor } from "./activity-cursor.js";
import type { ActivityCoverStorage } from "./activity-cover.storage.js";
import { activityForbidden, activityKycRequired, activityNotFound } from "./activity-errors.js";
import { toKycTrustSnapshot, type ActivityKycEnforcementContext } from "./activity-kyc.js";
import {
  activityPublicSelect,
  hostPreviewForViewer,
  toPublicActivitySource,
  type ActivityWithRelations,
} from "./activity-mapper.js";
import {
  canChangePublishedSchedule,
  canDecreaseCapacity,
  canManageOwnActivities,
  canPublishAudience,
  hasTrustedKycForActivityAction,
  isRealWorldActivityMode,
  requiresKycForPublish,
} from "./activity-policy.js";
import { applyActivityCancellationRecords } from "./activity-cancellation.js";
import { activityStartsAtWhere } from "./activity-my-inventory.policy.js";
import { ACTIVITY_LIST_DEFAULT_LIMIT, ACTIVITY_LIST_MAX_LIMIT } from "./activity.constants.js";
import { loadHostParticipationSummary } from "./activity-host-participation-summary.js";
import { toHostActivityDto } from "./activity.dto.js";
import type {
  CreateActivityInput,
  HostActivityListQuery,
  PatchActivityInput,
} from "./activity.validation.js";

export class ActivityHostService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly coverStorage: ActivityCoverStorage,
    private readonly kyc: ActivityKycEnforcementContext,
  ) {}

  async listMine(host: User, query: HostActivityListQuery) {
    this.assertManage(host);
    const limit = Math.min(query.limit ?? ACTIVITY_LIST_DEFAULT_LIMIT, ACTIVITY_LIST_MAX_LIMIT);
    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeActivityCreatedCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const when = query.when ?? "all";
    const rows = await this.db.activity.findMany({
      where: {
        hostId: host.id,
        ...(query.status ? { status: query.status } : {}),
        ...activityStartsAtWhere(when, new Date()),
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
      select: {
        ...activityPublicSelect,
        _count: {
          select: {
            participations: { where: { state: "CONFIRMED" } },
          },
        },
      },
    });

    const page = rows.slice(0, limit);
    const summaries = await Promise.all(
      page.map((row) => loadHostParticipationSummary(this.db, row.id)),
    );
    const viewerSnapshot = toDiscoverUserSnapshot(host);
    const activities = page.map((row, index) => {
      const source = toPublicActivitySource(row, row._count.participations);
      const hostPreview = hostPreviewForViewer(viewerSnapshot, row, false);
      const summary = summaries[index];
      return toHostActivityDto(source, hostPreview, {
        meetingInstructions: row.meetingInstructions,
        virtualMeetingDetails: row.virtualMeetingDetails,
        waitlistedCount: summary.approvedWaitlistedCount,
        hostParticipationSummary: summary,
        publishedAt: row.publishedAt,
        cancelledAt: row.cancelledAt,
        myParticipation: null,
      });
    });

    const nextCursor =
      rows.length > limit && page.length > 0
        ? encodeActivityCreatedCursor({
            createdAt: page[page.length - 1].createdAt.toISOString(),
            id: page[page.length - 1].id,
          })
        : null;

    return { activities, nextCursor };
  }

  async getMine(host: User, activityId: string) {
    this.assertManage(host);
    const row = await this.requireOwned(host.id, activityId);
    return this.toHostDto(host, row);
  }

  async createDraft(host: User, input: CreateActivityInput) {
    this.assertManage(host);
    const category = await this.requireCategory(input.category);
    const created = await this.db.activity.create({
      data: {
        hostId: host.id,
        title: input.title,
        description: input.description ?? null,
        categoryId: category.id,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        timeZone: input.timeZone,
        mode: input.mode,
        status: "DRAFT",
        audience: input.audience ?? "PUBLIC",
        venueName: input.venueName ?? null,
        locationCity: input.locationCity ?? null,
        locationRegion: input.locationRegion ?? null,
        meetingInstructions: input.meetingInstructions ?? null,
        virtualMeetingDetails: input.virtualMeetingDetails ?? null,
        skillNotes: input.skillNotes ?? null,
        gearNotes: input.gearNotes ?? null,
        capacity: input.capacity,
        waitlistEnabled: input.waitlistEnabled ?? false,
        joinMode: input.joinMode ?? "AUTO",
      },
      select: activityPublicSelect,
    });
    return this.toHostDto(host, created);
  }

  async patchMine(host: User, activityId: string, input: PatchActivityInput) {
    this.assertManage(host);
    const existing = await this.requireOwned(host.id, activityId);
    if (existing.status === "CANCELLED" || existing.status === "COMPLETED") {
      throw activityForbidden("Cancelled or completed activities cannot be edited");
    }

    const participantCount = await this.db.activityParticipation.count({
      where: { activityId, state: { in: ["CONFIRMED", "WAITLISTED", "PENDING"] } },
    });
    if (
      existing.status === "PUBLISHED" &&
      input.joinMode !== undefined &&
      input.joinMode !== existing.joinMode
    ) {
      throw new AppError("CONFLICT", "Join mode cannot change after an activity is published", 409);
    }
    const confirmedCount = await this.db.activityParticipation.count({
      where: { activityId, state: "CONFIRMED" },
    });

    const scheduleTouched =
      input.startsAt !== undefined || input.endsAt !== undefined || input.timeZone !== undefined;
    const modeTouched = input.mode !== undefined && input.mode !== existing.mode;
    if (
      existing.status === "PUBLISHED" &&
      (scheduleTouched || modeTouched) &&
      !canChangePublishedSchedule(participantCount)
    ) {
      throw new AppError(
        "CONFLICT",
        "Schedule and mode cannot change while participants are registered",
        409,
      );
    }

    if (input.capacity !== undefined && !canDecreaseCapacity(input.capacity, confirmedCount)) {
      throw new AppError(
        "CONFLICT",
        "Capacity cannot be reduced below the confirmed participant count",
        409,
      );
    }

    if (existing.status === "PUBLISHED" && input.audience === "FOLLOWERS_ONLY") {
      throw new AppError("VALIDATION_ERROR", "Followers-only audience is not available", 400);
    }

    const nextStartsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
    const nextEndsAt = input.endsAt ? new Date(input.endsAt) : existing.endsAt;
    if (nextEndsAt.getTime() <= nextStartsAt.getTime()) {
      throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
    }

    if (existing.status === "PUBLISHED" && isRealWorldActivityMode(input.mode ?? existing.mode)) {
      this.assertHostKyc(host, input.mode ?? existing.mode);
    }

    let categoryId = existing.categoryId;
    if (input.category) {
      categoryId = (await this.requireCategory(input.category)).id;
    }

    const updated = await this.db.activity.update({
      where: { id: activityId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { categoryId } : {}),
        ...(input.startsAt !== undefined ? { startsAt: nextStartsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: nextEndsAt } : {}),
        ...(input.timeZone !== undefined ? { timeZone: input.timeZone } : {}),
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        ...(input.audience !== undefined ? { audience: input.audience } : {}),
        ...(input.venueName !== undefined ? { venueName: input.venueName } : {}),
        ...(input.locationCity !== undefined ? { locationCity: input.locationCity } : {}),
        ...(input.locationRegion !== undefined ? { locationRegion: input.locationRegion } : {}),
        ...(input.meetingInstructions !== undefined
          ? { meetingInstructions: input.meetingInstructions }
          : {}),
        ...(input.virtualMeetingDetails !== undefined
          ? { virtualMeetingDetails: input.virtualMeetingDetails }
          : {}),
        ...(input.skillNotes !== undefined ? { skillNotes: input.skillNotes } : {}),
        ...(input.gearNotes !== undefined ? { gearNotes: input.gearNotes } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.waitlistEnabled !== undefined ? { waitlistEnabled: input.waitlistEnabled } : {}),
        ...(existing.status === "DRAFT" && input.joinMode !== undefined
          ? { joinMode: input.joinMode }
          : {}),
      },
      select: activityPublicSelect,
    });

    return this.toHostDto(host, updated);
  }

  async publishMine(host: User, activityId: string) {
    this.assertManage(host);
    const existing = await this.requireOwned(host.id, activityId);
    if (existing.status === "PUBLISHED") {
      return this.toHostDto(host, existing);
    }
    if (existing.status !== "DRAFT") {
      throw activityForbidden("Only drafts can be published");
    }
    if (!canPublishAudience(existing.audience)) {
      throw new AppError("VALIDATION_ERROR", "Followers-only audience is not available", 400);
    }

    this.assertPublishReady(existing);
    this.assertHostKyc(host, existing.mode);

    const updated = await this.db.activity.update({
      where: { id: activityId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
      select: activityPublicSelect,
    });
    return this.toHostDto(host, updated);
  }

  async cancelMine(host: User, activityId: string) {
    this.assertManage(host);
    const existing = await this.requireOwned(host.id, activityId);
    if (existing.status === "CANCELLED") {
      return this.toHostDto(host, existing);
    }
    if (existing.status === "COMPLETED") {
      throw activityForbidden("Completed activities cannot be cancelled");
    }

    const now = new Date();
    await this.db.$transaction(async (tx) => {
      await applyActivityCancellationRecords(tx, { activityId, now });
    });

    const row = await this.requireOwned(host.id, activityId);
    return this.toHostDto(host, row);
  }

  async replaceCover(host: User, activityId: string, file: { buffer: Buffer }) {
    this.assertManage(host);
    const existing = await this.requireOwned(host.id, activityId);
    if (existing.status === "CANCELLED" || existing.status === "COMPLETED") {
      throw activityForbidden("Cancelled or completed activities cannot be edited");
    }
    if (file.buffer.length === 0 || file.buffer.length > AVATAR_MAX_BYTES) {
      throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
    }

    const processed = await processAvatarUpload(file.buffer);
    const stored = await this.coverStorage.save(
      host.id,
      activityId,
      processed.buffer,
      processed.contentType,
    );
    const previousKey = existing.coverStorageKey;
    await this.db.activity.update({
      where: { id: activityId },
      data: { coverStorageKey: stored.storageKey, coverContentType: processed.contentType },
    });
    if (previousKey) {
      await this.coverStorage.deleteByStorageKey(previousKey, host.id).catch(() => undefined);
    }
    const row = await this.requireOwned(host.id, activityId);
    return this.toHostDto(host, row);
  }

  async deleteCover(host: User, activityId: string) {
    this.assertManage(host);
    const existing = await this.requireOwned(host.id, activityId);
    if (existing.status === "CANCELLED" || existing.status === "COMPLETED") {
      throw activityForbidden("Cancelled or completed activities cannot be edited");
    }
    const previousKey = existing.coverStorageKey;
    await this.db.activity.update({
      where: { id: activityId },
      data: { coverStorageKey: null, coverContentType: null },
    });
    if (previousKey) {
      await this.coverStorage.deleteByStorageKey(previousKey, host.id).catch(() => undefined);
    }
    const row = await this.requireOwned(host.id, activityId);
    return this.toHostDto(host, row);
  }

  async getOwnCoverBytes(
    host: User,
    activityId: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    this.assertManage(host);
    const row = await this.requireOwned(host.id, activityId);
    if (!row.coverStorageKey || !row.coverContentType) {
      throw activityNotFound();
    }
    const buffer = await this.coverStorage.readBytes(row.coverStorageKey, host.id);
    return { buffer, contentType: row.coverContentType };
  }

  private assertPublishReady(row: ActivityWithRelations): void {
    const now = Date.now();
    if (row.startsAt.getTime() <= now) {
      throw new AppError("VALIDATION_ERROR", "Published activities must start in the future", 400);
    }
    if (row.endsAt.getTime() <= row.startsAt.getTime()) {
      throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
    }
    if (row.mode === "IN_PERSON" || row.mode === "HYBRID") {
      if (!row.venueName || !row.locationCity) {
        throw new AppError(
          "VALIDATION_ERROR",
          "In-person and hybrid activities require a venue name and city before publish",
          400,
        );
      }
    }
    if (row.mode === "VIRTUAL" || row.mode === "HYBRID") {
      if (!row.virtualMeetingDetails) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Virtual and hybrid activities require virtual meeting details before publish",
          400,
        );
      }
    }
  }

  private assertHostKyc(host: User, mode: ActivityMode): void {
    if (!requiresKycForPublish(mode)) {
      return;
    }
    if (!hasTrustedKycForActivityAction(toKycTrustSnapshot(host), this.kyc)) {
      throw activityKycRequired();
    }
  }

  private async requireCategory(slug: string) {
    const category = await this.db.activityCategory.findUnique({
      where: { slug },
      select: { id: true, slug: true, label: true },
    });
    if (!category) {
      throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
    }
    return category;
  }

  private async requireOwned(hostId: string, activityId: string): Promise<ActivityWithRelations> {
    const row = await this.db.activity.findUnique({
      where: { id: activityId },
      select: activityPublicSelect,
    });
    if (!row || row.hostId !== hostId) {
      throw activityNotFound();
    }
    return row;
  }

  private async toHostDto(host: User, row: ActivityWithRelations) {
    const summary = await loadHostParticipationSummary(this.db, row.id);
    const source = toPublicActivitySource(row, summary.confirmedSeatCount);
    const hostPreview = hostPreviewForViewer(toDiscoverUserSnapshot(host), row, false);
    return toHostActivityDto(source, hostPreview, {
      meetingInstructions: row.meetingInstructions,
      virtualMeetingDetails: row.virtualMeetingDetails,
      waitlistedCount: summary.approvedWaitlistedCount,
      hostParticipationSummary: summary,
      publishedAt: row.publishedAt,
      cancelledAt: row.cancelledAt,
      myParticipation: null,
    });
  }

  private assertManage(host: User): void {
    if (!canManageOwnActivities(toPolicyActor(host))) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Activities are not available in the current account state",
        403,
      );
    }
  }
}
