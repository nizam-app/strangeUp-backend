import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { canAccessAccount, hasFullAccountAccess, toPolicyActor } from "../policy/account-policy.js";
import { SavedActivityService } from "../saved-activities/saved-activity.service.js";
import { buildSettingsMembershipSummary } from "../membership/membership-entitlements.js";
import { buildSettingsCapabilities } from "./settings-capabilities.js";

export class SettingsOverviewService {
  private readonly savedActivities: SavedActivityService;

  constructor(private readonly db: DatabaseClient) {
    this.savedActivities = new SavedActivityService(db);
  }

  async getOverview(user: User) {
    const actor = toPolicyActor(user);
    if (!canAccessAccount(actor, user.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    const fullAccess = hasFullAccountAccess(actor);
    const now = new Date();

    const profile = await this.db.profile.findUnique({
      where: { userId: user.id },
      select: {
        displayName: true,
        username: true,
        avatarStorageKey: true,
        profileVisibility: true,
      },
    });

    const [
      hostedUpcomingCount,
      confirmedRsvpCount,
      savedActivityCount,
      activeGroupMembershipCount,
      blockedUserCount,
      savedJobCount,
      jobApplicationCount,
      activeSessionCount,
    ] = await Promise.all([
      fullAccess
        ? this.db.activity.count({
            where: {
              hostId: user.id,
              status: "PUBLISHED",
              cancelledAt: null,
              startsAt: { gt: now },
            },
          })
        : Promise.resolve(0),
      fullAccess
        ? this.db.activityParticipation.count({
            where: {
              userId: user.id,
              state: "CONFIRMED",
              activity: {
                status: "PUBLISHED",
                cancelledAt: null,
                startsAt: { gt: now },
              },
            },
          })
        : Promise.resolve(0),
      fullAccess ? this.savedActivities.countSaved(user.id) : Promise.resolve(0),
      fullAccess
        ? this.db.communityMembership.count({
            where: { userId: user.id, status: "ACTIVE" },
          })
        : Promise.resolve(0),
      this.db.userBlock.count({ where: { blockerId: user.id } }),
      fullAccess ? this.db.savedJob.count({ where: { userId: user.id } }) : Promise.resolve(0),
      fullAccess
        ? this.db.jobApplication.count({ where: { applicantUserId: user.id } })
        : Promise.resolve(0),
      this.db.session.count({
        where: {
          userId: user.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      }),
    ]);

    return {
      profile: {
        displayName: profile?.displayName ?? null,
        username: profile?.username ?? null,
        hasAvatar: profile?.avatarStorageKey !== null && profile?.avatarStorageKey !== undefined,
        profileVisibility: profile?.profileVisibility ?? null,
      },
      account: {
        email: user.email,
        emailVerified: user.emailVerifiedAt !== null,
        phoneE164: user.phoneE164,
        phoneVerified: user.phoneVerifiedAt !== null,
        accountStatus: user.accountStatus,
        identityVerificationStatus: user.identityVerificationStatus,
        fullAccess,
      },
      counts: {
        hostedUpcomingActivities: hostedUpcomingCount,
        confirmedUpcomingRsvps: confirmedRsvpCount,
        savedActivities: savedActivityCount,
        activeGroupMemberships: activeGroupMembershipCount,
        blockedUsers: blockedUserCount,
        savedJobs: savedJobCount,
        jobApplications: jobApplicationCount,
        activeSessions: activeSessionCount,
      },
      capabilities: buildSettingsCapabilities(),
      membership: buildSettingsMembershipSummary(user.id),
      relatedRoutes: {
        account: "GET /v1/me/account",
        profile: "GET /v1/me/profile",
        passwordChange: "POST /v1/me/password-change",
        blocks: "GET /v1/me/blocks",
        savedActivities: "GET /v1/me/saved-activities",
        activityRsvps: "GET /v1/me/activity-rsvps",
        hostedActivities: "GET /v1/me/activities",
        groups: "GET /v1/me/groups",
        savedJobs: "GET /v1/me/saved-jobs",
        jobApplications: "GET /v1/me/job-applications",
        sessions: "GET /v1/me/security/sessions",
        logout: "POST /v1/auth/logout",
        logoutAll: "POST /v1/auth/logout-all",
        accountDeletionImpact: "GET /v1/me/account-deletion/impact",
        membershipPlans: "GET /v1/membership/plans",
        membership: "GET /v1/me/membership",
      },
    };
  }
}
