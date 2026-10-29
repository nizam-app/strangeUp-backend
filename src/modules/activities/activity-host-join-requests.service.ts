import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { hasFullAccountAccess, toPolicyActor } from "../policy/account-policy.js";
import {
  canViewPublicProfile,
  toDiscoverUserSnapshot,
} from "../policy/public-profile-policy.js";
import { toPublicProfilePreview } from "../discovery/public-profile.dto.js";
import { decodeActivityStartsCursor, encodeActivityStartsCursor } from "./activity-cursor.js";
import { activityForbidden, activityNotFound } from "./activity-errors.js";
import { toKycTrustSnapshot, type ActivityKycEnforcementContext } from "./activity-kyc.js";
import {
  canManageOwnActivities,
  hasTrustedKycForActivityAction,
  isUpcomingInstant,
  requiresKycForConfirmedJoin,
} from "./activity-policy.js";
import { toMyParticipationDto } from "./activity.dto.js";
import { ACTIVITY_LIST_DEFAULT_LIMIT, ACTIVITY_LIST_MAX_LIMIT } from "./activity.constants.js";
import type { HostJoinRequestListQuery } from "./activity.validation.js";
import { NotificationEmitter } from "../notifications/notification-emitter.service.js";

export type HostJoinRequestApplicantDto = {
  userId: string;
  profile: ReturnType<typeof toPublicProfilePreview>;
  requestedAt: string;
  participation: NonNullable<ReturnType<typeof toMyParticipationDto>>;
};

export class ActivityHostJoinRequestsService {
  private readonly notifications: NotificationEmitter;

  constructor(
    private readonly db: DatabaseClient,
    private readonly kyc: ActivityKycEnforcementContext,
    notifications?: NotificationEmitter,
  ) {
    this.notifications = notifications ?? new NotificationEmitter(db);
  }

  async listPending(host: User, activityId: string, query: HostJoinRequestListQuery) {
    await this.assertHostOwns(host, activityId);
    const limit = Math.min(query.limit ?? ACTIVITY_LIST_DEFAULT_LIMIT, ACTIVITY_LIST_MAX_LIMIT);
    const status = query.status ?? "pending";
    const stateFilter =
      status === "pending"
        ? ("PENDING" as const)
        : status === "declined"
          ? ("DECLINED" as const)
          : ("WAITLISTED" as const);

    let cursorJoinedAt: Date | undefined;
    let cursorUserId: string | undefined;
    if (query.cursor) {
      const decoded = decodeActivityStartsCursor(query.cursor);
      cursorJoinedAt = new Date(decoded.startsAt);
      cursorUserId = decoded.id;
    }

    const activity = await this.db.activity.findUnique({
      where: { id: activityId },
      select: { joinMode: true },
    });
    if (!activity || activity.joinMode !== "HOST_APPROVAL") {
      throw activityForbidden("Join requests are only available for host-approval activities");
    }

    const rows = await this.db.activityParticipation.findMany({
      where: {
        activityId,
        state: stateFilter,
        ...(status === "waitlisted" ? { hostApprovedAt: { not: null } } : {}),
        ...(cursorJoinedAt && cursorUserId
          ? {
              OR: [
                { joinedAt: { gt: cursorJoinedAt } },
                { AND: [{ joinedAt: cursorJoinedAt }, { userId: { gt: cursorUserId } }] },
              ],
            }
          : {}),
      },
      orderBy: [{ joinedAt: "asc" }, { userId: "asc" }],
      take: limit + 1,
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
            identityVerificationSessionId: true,
            adminReviewStatus: true,
            adminReviewVerificationSessionId: true,
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
    const hostSnapshot = toDiscoverUserSnapshot(host);
    const requests: HostJoinRequestApplicantDto[] = [];
    for (const row of page) {
      const blocked = await isBlockedEitherDirection(this.db, host.id, row.userId);
      const profile = row.user.profile;
      const applicantSnapshot = toDiscoverUserSnapshot(row.user);
      const visible = profile
        ? canViewPublicProfile(
            hostSnapshot,
            applicantSnapshot,
            profile.profileVisibility,
            blocked,
          )
        : false;
      const participation = toMyParticipationDto(row, activity.joinMode);
      if (!participation) {
        continue;
      }
      requests.push({
        userId: row.userId,
        profile: visible
          ? toPublicProfilePreview({
              userId: row.user.id,
              displayName: profile?.displayName ?? null,
              username: profile?.username ?? null,
              avatarStorageKey: profile?.avatarStorageKey ?? null,
              locationCity: profile?.locationCity ?? null,
              locationRegion: profile?.locationRegion ?? null,
            })
          : {
              userId: row.userId,
              displayName: null,
              username: null,
              hasAvatar: false,
              locationCity: null,
              locationRegion: null,
            },
        requestedAt: row.joinedAt.toISOString(),
        participation,
      });
    }

    const nextCursor =
      rows.length > limit && page.length > 0
        ? encodeActivityStartsCursor({
            startsAt: page[page.length - 1].joinedAt.toISOString(),
            id: page[page.length - 1].userId,
          })
        : null;

    return { requests, nextCursor };
  }

  async approve(host: User, activityId: string, applicantUserId: string) {
    this.assertManage(host);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "Activity" WHERE "id" = ${activityId} FOR UPDATE`;
      const activity = await tx.activity.findUnique({
        where: { id: activityId },
        select: {
          id: true,
          hostId: true,
          joinMode: true,
          status: true,
          mode: true,
          capacity: true,
          waitlistEnabled: true,
          startsAt: true,
        },
      });
      if (!activity || activity.hostId !== host.id) {
        throw activityNotFound();
      }
      if (activity.joinMode !== "HOST_APPROVAL") {
        throw activityForbidden("This activity does not use host approval");
      }
      if (activity.status !== "PUBLISHED") {
        throw activityForbidden("Join requests can only be reviewed on published activities");
      }
      if (!isUpcomingInstant(activity.startsAt, new Date())) {
        throw activityForbidden("This activity is no longer open for join review");
      }

      const participation = await tx.activityParticipation.findUnique({
        where: { activityId_userId: { activityId, userId: applicantUserId } },
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
              identityVerificationSessionId: true,
              adminReviewStatus: true,
              adminReviewVerificationSessionId: true,
            },
          },
        },
      });
      if (!participation) {
        throw activityNotFound();
      }
      if (participation.state === "CONFIRMED" || participation.state === "WAITLISTED") {
        const dto = toMyParticipationDto(participation, activity.joinMode);
        if (!dto) {
          throw activityNotFound();
        }
        return dto;
      }
      if (participation.state !== "PENDING") {
        throw new AppError("CONFLICT", "Only pending join requests can be approved", 409);
      }

      const blocked = await isBlockedEitherDirection(tx, applicantUserId, host.id);
      if (blocked) {
        throw new AppError("CONFLICT", "Applicant is not eligible for this activity", 409);
      }
      if (!hasFullAccountAccess(toPolicyActor(participation.user))) {
        throw new AppError("CONFLICT", "Applicant is not eligible for this activity", 409);
      }
      if (
        requiresKycForConfirmedJoin(activity.mode) &&
        !hasTrustedKycForActivityAction(toKycTrustSnapshot(participation.user), this.kyc)
      ) {
        throw new AppError(
          "CONFLICT",
          "Applicant does not meet verification requirements for this activity",
          409,
        );
      }

      const now = new Date();
      const confirmedCount = await tx.activityParticipation.count({
        where: { activityId, state: "CONFIRMED" },
      });

      if (confirmedCount < activity.capacity) {
        const saved = await tx.activityParticipation.update({
          where: { id: participation.id },
          data: {
            state: "CONFIRMED",
            waitlistPosition: null,
            hostApprovedAt: now,
          },
        });
        await this.notifications.emitInTransaction(tx, {
          recipientId: applicantUserId,
          type: "ACTIVITY_JOIN_REQUEST_APPROVED",
          sourceId: activityId,
          actorUserId: host.id,
          title: "Join request approved",
          body: "Your spot is confirmed for this activity.",
          dedupeKey: `activity-join-approved:${activityId}:${applicantUserId}`,
        });
        const dto = toMyParticipationDto(saved, activity.joinMode);
        if (!dto) {
          throw activityNotFound();
        }
        return dto;
      }

      if (!activity.waitlistEnabled) {
        throw new AppError(
          "CONFLICT",
          "Activity is at capacity and waitlisting is disabled",
          409,
        );
      }

      const last = await tx.activityParticipation.findFirst({
        where: { activityId, state: "WAITLISTED" },
        orderBy: { waitlistPosition: "desc" },
        select: { waitlistPosition: true },
      });
      const waitlistPosition = (last?.waitlistPosition ?? 0) + 1;
      const saved = await tx.activityParticipation.update({
        where: { id: participation.id },
        data: {
          state: "WAITLISTED",
          waitlistPosition,
          hostApprovedAt: now,
        },
      });
      await this.notifications.emitInTransaction(tx, {
        recipientId: applicantUserId,
        type: "ACTIVITY_JOIN_REQUEST_APPROVED",
        sourceId: activityId,
        actorUserId: host.id,
        title: "Join request approved",
        body: "You are on the approved waitlist for this activity.",
        dedupeKey: `activity-join-approved-waitlist:${activityId}:${applicantUserId}`,
      });
      const dto = toMyParticipationDto(saved, activity.joinMode);
      if (!dto) {
        throw activityNotFound();
      }
      return dto;
    });
  }

  async decline(host: User, activityId: string, applicantUserId: string) {
    this.assertManage(host);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "Activity" WHERE "id" = ${activityId} FOR UPDATE`;
      const activity = await tx.activity.findUnique({
        where: { id: activityId },
        select: { id: true, hostId: true, joinMode: true, status: true, startsAt: true },
      });
      if (!activity || activity.hostId !== host.id) {
        throw activityNotFound();
      }
      if (activity.joinMode !== "HOST_APPROVAL") {
        throw activityForbidden("This activity does not use host approval");
      }
      if (activity.status !== "PUBLISHED") {
        throw activityForbidden("Join requests can only be reviewed on published activities");
      }

      const participation = await tx.activityParticipation.findUnique({
        where: { activityId_userId: { activityId, userId: applicantUserId } },
      });
      if (!participation) {
        throw activityNotFound();
      }
      if (participation.state === "DECLINED") {
        const dto = toMyParticipationDto(participation, activity.joinMode);
        if (!dto) {
          throw activityNotFound();
        }
        return dto;
      }
      if (participation.state !== "PENDING") {
        throw new AppError("CONFLICT", "Only pending join requests can be declined", 409);
      }

      const saved = await tx.activityParticipation.update({
        where: { id: participation.id },
        data: {
          state: "DECLINED",
          waitlistPosition: null,
          hostApprovedAt: null,
        },
      });
      await this.notifications.emitInTransaction(tx, {
        recipientId: applicantUserId,
        type: "ACTIVITY_JOIN_REQUEST_DECLINED",
        sourceId: activityId,
        actorUserId: host.id,
        title: "Join request declined",
        body: "The host declined your request to join this activity.",
        dedupeKey: `activity-join-declined:${activityId}:${applicantUserId}`,
      });
      const dto = toMyParticipationDto(saved, activity.joinMode);
      if (!dto) {
        throw activityNotFound();
      }
      return dto;
    });
  }

  private async assertHostOwns(host: User, activityId: string): Promise<void> {
    this.assertManage(host);
    const row = await this.db.activity.findUnique({
      where: { id: activityId },
      select: { hostId: true },
    });
    if (!row || row.hostId !== host.id) {
      throw activityNotFound();
    }
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
