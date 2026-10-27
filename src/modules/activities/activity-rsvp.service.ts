import { Prisma, type User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { hasFullAccountAccess, toPolicyActor } from "../policy/account-policy.js";
import { toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { decodeActivityStartsCursor, encodeActivityStartsCursor } from "./activity-cursor.js";
import { activityForbidden, activityKycRequired, activityNotFound } from "./activity-errors.js";
import { toKycTrustSnapshot, type ActivityKycEnforcementContext } from "./activity-kyc.js";
import {
  activityPublicSelect,
  hostPreviewForViewer,
  toPublicActivitySource,
} from "./activity-mapper.js";
import {
  canBrowseActivities,
  decideWaitlistPromotion,
  isUpcomingInstant,
  resolveJoinPath,
} from "./activity-policy.js";
import { ACTIVITY_LIST_DEFAULT_LIMIT, ACTIVITY_LIST_MAX_LIMIT } from "./activity.constants.js";
import {
  toMyParticipationDto,
  toPublicActivityCard,
  type MyActivityRsvpDto,
} from "./activity.dto.js";
import type { MyRsvpListQuery } from "./activity.validation.js";
import { NotificationEmitter } from "../notifications/notification-emitter.service.js";

export class ActivityRsvpService {
  private readonly notifications: NotificationEmitter;

  constructor(
    private readonly db: DatabaseClient,
    private readonly kyc: ActivityKycEnforcementContext,
    notifications?: NotificationEmitter,
  ) {
    this.notifications = notifications ?? new NotificationEmitter(db);
  }

  async rsvp(viewer: User, activityId: string) {
    this.assertBrowse(viewer);
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT 1 FROM "Activity" WHERE "id" = ${activityId} FOR UPDATE`;
        const activity = await tx.activity.findUnique({
          where: { id: activityId },
          select: activityPublicSelect,
        });
        if (!activity || activity.status !== "PUBLISHED" || activity.audience !== "PUBLIC") {
          throw activityNotFound();
        }
        if (activity.hostId === viewer.id) {
          throw activityForbidden("Hosts cannot join their own activity");
        }
        const blocked = await isBlockedEitherDirection(tx, viewer.id, activity.hostId);
        if (blocked) {
          throw activityNotFound();
        }
        if (!isUpcomingInstant(activity.startsAt, new Date())) {
          throw activityForbidden("This activity is no longer open for joins");
        }

        const existing = await tx.activityParticipation.findUnique({
          where: { activityId_userId: { activityId, userId: viewer.id } },
        });
        if (existing?.state === "CONFIRMED" || existing?.state === "WAITLISTED") {
          return toMyParticipationDto(existing);
        }

        const confirmedCount = await tx.activityParticipation.count({
          where: { activityId, state: "CONFIRMED" },
        });
        const path = resolveJoinPath({
          isHost: false,
          status: activity.status,
          upcoming: true,
          confirmedCount,
          capacity: activity.capacity,
          waitlistEnabled: activity.waitlistEnabled,
          existingState: existing?.state ?? null,
          mode: activity.mode,
          kycTrust: toKycTrustSnapshot(viewer),
          kyc: this.kyc,
        });

        if (path === "kyc_required") {
          throw activityKycRequired();
        }
        if (path === "full") {
          throw new AppError("CONFLICT", "This activity is at capacity", 409);
        }
        if (path === "closed" || path === "host") {
          throw activityForbidden("This activity is not open for joins");
        }

        const now = new Date();
        if (path === "waitlist") {
          const last = await tx.activityParticipation.findFirst({
            where: { activityId, state: "WAITLISTED" },
            orderBy: { waitlistPosition: "desc" },
            select: { waitlistPosition: true },
          });
          const waitlistPosition = (last?.waitlistPosition ?? 0) + 1;
          const saved = existing
            ? await tx.activityParticipation.update({
                where: { id: existing.id },
                data: {
                  state: "WAITLISTED",
                  waitlistPosition,
                  cancelledAt: null,
                  joinedAt: now,
                },
              })
            : await tx.activityParticipation.create({
                data: {
                  activityId,
                  userId: viewer.id,
                  state: "WAITLISTED",
                  waitlistPosition,
                  joinedAt: now,
                },
              });
          await this.notifications.emitInTransaction(tx, {
            recipientId: viewer.id,
            type: "ACTIVITY_RSVP_WAITLISTED",
            sourceId: activityId,
            title: "Added to waitlist",
            body: "You are waitlisted for this activity.",
            dedupeKey: `activity-rsvp:waitlisted:${activityId}:${viewer.id}`,
          });
          return toMyParticipationDto(saved);
        }

        const saved = existing
          ? await tx.activityParticipation.update({
              where: { id: existing.id },
              data: {
                state: "CONFIRMED",
                waitlistPosition: null,
                cancelledAt: null,
                joinedAt: now,
              },
            })
          : await tx.activityParticipation.create({
              data: {
                activityId,
                userId: viewer.id,
                state: "CONFIRMED",
                waitlistPosition: null,
                joinedAt: now,
              },
            });
        await this.notifications.emitInTransaction(tx, {
          recipientId: viewer.id,
          type: "ACTIVITY_RSVP_CONFIRMED",
          sourceId: activityId,
          title: "RSVP confirmed",
          body: "Your spot is confirmed for this activity.",
          dedupeKey: `activity-rsvp:confirmed:${activityId}:${viewer.id}`,
        });
        return toMyParticipationDto(saved);
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await this.db.activityParticipation.findUnique({
          where: { activityId_userId: { activityId, userId: viewer.id } },
        });
        if (existing) {
          return toMyParticipationDto(existing);
        }
      }
      throw err;
    }
  }

  async leave(viewer: User, activityId: string) {
    this.assertBrowse(viewer);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "Activity" WHERE "id" = ${activityId} FOR UPDATE`;
      const activity = await tx.activity.findUnique({
        where: { id: activityId },
        select: { id: true, hostId: true, mode: true, capacity: true, status: true },
      });
      if (!activity) {
        throw activityNotFound();
      }
      if (activity.hostId === viewer.id) {
        throw activityForbidden("Hosts cannot leave their own activity");
      }
      const blocked = await isBlockedEitherDirection(tx, viewer.id, activity.hostId);
      if (blocked && activity.status === "PUBLISHED") {
        throw activityNotFound();
      }

      const existing = await tx.activityParticipation.findUnique({
        where: { activityId_userId: { activityId, userId: viewer.id } },
      });
      if (!existing || existing.state === "CANCELLED") {
        return { left: true as const, promoted: false as const };
      }

      const wasConfirmed = existing.state === "CONFIRMED";
      await tx.activityParticipation.update({
        where: { id: existing.id },
        data: { state: "CANCELLED", waitlistPosition: null, cancelledAt: new Date() },
      });

      let promoted = false;
      if (wasConfirmed && activity.status === "PUBLISHED") {
        const promotedUserId = await this.tryPromoteHead(tx, activity);
        promoted = promotedUserId !== null;
        if (promotedUserId) {
          await this.notifications.emitInTransaction(tx, {
            recipientId: promotedUserId,
            type: "ACTIVITY_WAITLIST_PROMOTED",
            sourceId: activity.id,
            title: "Waitlist spot opened",
            body: "You are now confirmed for this activity.",
            dedupeKey: `activity-waitlist-promoted:${activity.id}:${promotedUserId}`,
          });
        }
      }
      return { left: true as const, promoted };
    });
  }

  async listMine(
    viewer: User,
    query: MyRsvpListQuery,
  ): Promise<{
    rsvps: MyActivityRsvpDto[];
    nextCursor: string | null;
  }> {
    this.assertBrowse(viewer);
    const limit = Math.min(query.limit ?? ACTIVITY_LIST_DEFAULT_LIMIT, ACTIVITY_LIST_MAX_LIMIT);
    let cursor: { startsAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeActivityStartsCursor(query.cursor);
      cursor = { startsAt: new Date(decoded.startsAt), id: decoded.id };
    }

    const rows = await this.db.activityParticipation.findMany({
      where: {
        userId: viewer.id,
        state: { in: ["CONFIRMED", "WAITLISTED"] },
        activity: {
          ...(cursor
            ? {
                OR: [
                  { startsAt: { gt: cursor.startsAt } },
                  { AND: [{ startsAt: cursor.startsAt }, { id: { gt: cursor.id } }] },
                ],
              }
            : {}),
        },
      },
      orderBy: [{ activity: { startsAt: "asc" } }, { activity: { id: "asc" } }],
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

    const page = rows.slice(0, limit);
    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const rsvps: MyActivityRsvpDto[] = [];
    for (const row of page) {
      const myParticipation = toMyParticipationDto(row);
      if (!myParticipation) {
        continue;
      }
      const blocked = await isBlockedEitherDirection(this.db, viewer.id, row.activity.hostId);
      const source = toPublicActivitySource(row.activity, row.activity._count.participations);
      const hostPreview = hostPreviewForViewer(viewerSnapshot, row.activity, blocked);
      rsvps.push({
        activity: toPublicActivityCard(source, hostPreview),
        myParticipation,
      });
    }

    const nextCursor =
      rows.length > limit && page.length > 0
        ? encodeActivityStartsCursor({
            startsAt: page[page.length - 1].activity.startsAt.toISOString(),
            id: page[page.length - 1].activity.id,
          })
        : null;

    return { rsvps, nextCursor };
  }

  private async tryPromoteHead(
    tx: Prisma.TransactionClient,
    activity: {
      id: string;
      hostId: string;
      mode: "IN_PERSON" | "VIRTUAL" | "HYBRID";
      capacity: number;
    },
  ): Promise<string | null> {
    const confirmedCount = await tx.activityParticipation.count({
      where: { activityId: activity.id, state: "CONFIRMED" },
    });
    const next = await tx.activityParticipation.findFirst({
      where: { activityId: activity.id, state: "WAITLISTED" },
      orderBy: [{ waitlistPosition: "asc" }, { joinedAt: "asc" }],
      include: {
        user: {
          select: {
            id: true,
            accountStatus: true,
            emailVerifiedAt: true,
            ageEligibilityStatus: true,
            suspendedAt: true,
            deletedAt: true,
            identityVerificationStatus: true,
            identityVerificationApprovedAt: true,
            identityVerificationValidUntil: true,
            identityVerificationRevokedAt: true,
          },
        },
      },
    });

    const blocked = next
      ? await isBlockedEitherDirection(tx, next.user.id, activity.hostId)
      : false;
    const decision = decideWaitlistPromotion({
      hasOpenSeat: confirmedCount < activity.capacity,
      nextQueued: next
        ? {
            accountEligible: hasFullAccountAccess({
              userId: next.user.id,
              accountStatus: next.user.accountStatus,
              emailVerifiedAt: next.user.emailVerifiedAt,
              ageEligibilityStatus: next.user.ageEligibilityStatus,
              suspendedAt: next.user.suspendedAt,
              deletedAt: next.user.deletedAt,
            }),
            blockedWithHost: blocked,
            kycTrust: toKycTrustSnapshot(next.user),
          }
        : null,
      mode: activity.mode,
      kyc: this.kyc,
    });

    if (decision.action !== "promote" || !next) {
      return null;
    }

    await tx.activityParticipation.update({
      where: { id: next.id },
      data: { state: "CONFIRMED", waitlistPosition: null },
    });
    return next.user.id;
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
}
