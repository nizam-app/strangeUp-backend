import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { isBlockedEitherDirection } from "../blocks/block-access.js";
import { toPublicProfilePreview } from "../discovery/public-profile.dto.js";
import { hasFullAccountAccess, toPolicyActor } from "../policy/account-policy.js";
import { canViewPublicProfile, toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { decodeActivityStartsCursor, encodeActivityStartsCursor } from "./activity-cursor.js";
import { activityForbidden, activityNotFound } from "./activity-errors.js";
import { canBrowseActivities, canManageOwnActivities } from "./activity-policy.js";
import { canViewActivityConfirmedRoster } from "./activity-roster-policy.js";
import {
  ACTIVITY_LIST_DEFAULT_LIMIT,
  ACTIVITY_LIST_MAX_LIMIT,
  ACTIVITY_ROSTER_PREVIEW_MAX,
} from "./activity.constants.js";
import type { ActivityRosterQuery } from "./activity.validation.js";

const rosterUserSelect = {
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
} as const;

export type ActivityRosterAttendeeDto = {
  userId: string;
  profile: ReturnType<typeof toPublicProfilePreview>;
  confirmedAt: string;
};

export class ActivityRosterService {
  constructor(private readonly db: DatabaseClient) {}

  async listConfirmedRoster(viewer: User, activityId: string, query: ActivityRosterQuery) {
    this.assertBrowse(viewer);
    await this.assertRosterAccess(viewer, activityId);

    const previewCap = query.preview === true;
    const maxLimit = previewCap ? ACTIVITY_ROSTER_PREVIEW_MAX : ACTIVITY_LIST_MAX_LIMIT;
    const limit = Math.min(query.limit ?? ACTIVITY_LIST_DEFAULT_LIMIT, maxLimit);

    let cursorJoinedAt: Date | undefined;
    let cursorUserId: string | undefined;
    if (query.cursor) {
      const decoded = decodeActivityStartsCursor(query.cursor);
      cursorJoinedAt = new Date(decoded.startsAt);
      cursorUserId = decoded.id;
    }

    const confirmedCount = await this.db.activityParticipation.count({
      where: { activityId, state: "CONFIRMED" },
    });

    const rows = await this.db.activityParticipation.findMany({
      where: {
        activityId,
        state: "CONFIRMED",
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
      include: { user: { select: rosterUserSelect } },
    });

    const page = rows.slice(0, limit);
    const viewerSnapshot = toDiscoverUserSnapshot(viewer);
    const attendees: ActivityRosterAttendeeDto[] = [];

    for (const row of page) {
      const blocked = await isBlockedEitherDirection(this.db, viewer.id, row.userId);
      const profile = row.user.profile;
      const targetSnapshot = toDiscoverUserSnapshot(row.user);
      const visible = profile
        ? canViewPublicProfile(viewerSnapshot, targetSnapshot, profile.profileVisibility, blocked)
        : false;
      attendees.push({
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
        confirmedAt: row.joinedAt.toISOString(),
      });
    }

    const nextCursor =
      rows.length > limit && page.length > 0
        ? encodeActivityStartsCursor({
            startsAt: page[page.length - 1].joinedAt.toISOString(),
            id: page[page.length - 1].userId,
          })
        : null;

    return {
      activityId,
      confirmedCount,
      attendees,
      nextCursor,
    };
  }

  private async assertRosterAccess(viewer: User, activityId: string): Promise<void> {
    const activity = await this.db.activity.findUnique({
      where: { id: activityId },
      select: { id: true, hostId: true },
    });
    if (!activity) {
      throw activityNotFound();
    }

    const isHost = activity.hostId === viewer.id;
    const hostCanManage = isHost && canManageOwnActivities(toPolicyActor(viewer));
    const participation = await this.db.activityParticipation.findUnique({
      where: { activityId_userId: { activityId, userId: viewer.id } },
      select: { state: true },
    });

    if (
      !canViewActivityConfirmedRoster({
        isHost,
        hostCanManage,
        viewerParticipationState: participation?.state ?? null,
      })
    ) {
      throw activityNotFound();
    }
  }

  private assertBrowse(viewer: User): void {
    if (!canBrowseActivities(toPolicyActor(viewer))) {
      throw activityForbidden("Activities are not available in the current account state");
    }
    if (!hasFullAccountAccess(toPolicyActor(viewer))) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Activities are not available in the current account state",
        403,
      );
    }
  }
}
