import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { profileHasAvatar, resolveIdentityReviewDisplayName } from "./identity-review-profile.js";
import { resolveAccountModerationCapabilities } from "./admin-account-moderation.policy.js";
import {
  buildAdminUsersFilterFingerprint,
  buildAdminUsersListWhere,
  decodeListCursor,
  encodeListCursor,
  type AdminUsersListFilters,
} from "./admin-users-list-query.js";
import { userIsActiveSuperAdmin } from "./platform-staff-policy.js";

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) {
    return "***";
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

function maskPhoneE164(phoneE164: string): string {
  const trimmed = phoneE164.trim();
  if (trimmed.length <= 4) {
    return "***";
  }
  return `${trimmed.slice(0, 3)}***${trimmed.slice(-2)}`;
}

function formatLocationSummary(
  city: string | null | undefined,
  region: string | null | undefined,
): string | null {
  const parts = [city?.trim(), region?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export class AdminUsersService {
  constructor(private readonly db: DatabaseClient) {}

  async getUsersSummary() {
    const where = { deletedAt: null };
    const totalUsers = await this.db.user.count({ where });
    return {
      scope: "GLOBAL_USER_TOTALS" as const,
      totalUsers,
    };
  }

  async listUsers(input: {
    limit: number;
    cursor?: string;
    q?: string;
    accountStatus?: AdminUsersListFilters["accountStatus"];
    identityVerificationStatus?: AdminUsersListFilters["identityVerificationStatus"];
    adminReviewStatus?: AdminUsersListFilters["adminReviewStatus"];
  }) {
    const filters: AdminUsersListFilters = {
      q: input.q,
      accountStatus: input.accountStatus,
      identityVerificationStatus: input.identityVerificationStatus,
      adminReviewStatus: input.adminReviewStatus,
    };
    const filterFingerprint = buildAdminUsersFilterFingerprint(filters);
    const cursor = decodeListCursor(input.cursor, filterFingerprint);

    const baseWhere = buildAdminUsersListWhere(filters);
    const andParts = Array.isArray(baseWhere.AND) ? [...baseWhere.AND] : [baseWhere];
    if (cursor) {
      andParts.push({
        OR: [
          { createdAt: { lt: cursor.updatedAt } },
          {
            AND: [{ createdAt: cursor.updatedAt }, { id: { lt: cursor.userId } }],
          },
        ],
      });
    }

    const take = input.limit + 1;
    const rows = await this.db.user.findMany({
      where: { AND: andParts },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      select: {
        id: true,
        email: true,
        createdAt: true,
        accountStatus: true,
        identityVerificationStatus: true,
        adminReviewStatus: true,
        profile: {
          select: {
            displayName: true,
            firstName: true,
            lastName: true,
            avatarStorageKey: true,
            locationCity: true,
            locationRegion: true,
          },
        },
      },
    });

    const page = rows.slice(0, input.limit);
    const nextCursor =
      rows.length > input.limit && page.length > 0
        ? encodeListCursor({
            updatedAt: page[page.length - 1].createdAt,
            userId: page[page.length - 1].id,
            filterFingerprint,
          })
        : null;

    return {
      users: page.map((row) => ({
        userId: row.id,
        displayName: resolveIdentityReviewDisplayName(row.profile),
        maskedEmail: maskEmail(row.email),
        hasAvatar: profileHasAvatar(row.profile),
        locationSummary: formatLocationSummary(
          row.profile?.locationCity,
          row.profile?.locationRegion,
        ),
        accountStatus: row.accountStatus,
        identityVerificationStatus: row.identityVerificationStatus,
        adminReviewStatus: row.adminReviewStatus,
        registeredAt: row.createdAt.toISOString(),
      })),
      nextCursor,
      filterFingerprint,
    };
  }

  async getUserDetail(userId: string, actorUserId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phoneE164: true,
        phoneVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        accountStatus: true,
        emailVerifiedAt: true,
        ageEligibilityStatus: true,
        identityVerificationStatus: true,
        identityVerificationApprovedAt: true,
        identityVerificationValidUntil: true,
        identityVerificationRevokedAt: true,
        identityVerificationSessionId: true,
        adminReviewStatus: true,
        adminReviewVerificationSessionId: true,
        adminReviewDecidedAt: true,
        suspendedAt: true,
        deletedAt: true,
        profile: {
          select: {
            displayName: true,
            firstName: true,
            lastName: true,
            username: true,
            bio: true,
            avatarStorageKey: true,
            locationCity: true,
            locationRegion: true,
            scheduleTimeZone: true,
            profileVisibility: true,
          },
        },
      },
    });
    if (!user || user.deletedAt) {
      throw new AppError("NOT_FOUND", "User not found", 404);
    }

    const session = user.identityVerificationSessionId
      ? await this.db.verificationSession.findFirst({
          where: { id: user.identityVerificationSessionId, userId: user.id },
          select: {
            id: true,
            status: true,
            provider: true,
            completedAt: true,
            sessionExpiresAt: true,
            updatedAt: true,
          },
        })
      : null;

    const recentDecisions = await this.db.identityAdminReviewDecision.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        reasonCode: true,
        verificationSessionId: true,
        reviewerUserId: true,
        createdAt: true,
      },
    });

    const providerCompletedAt = session?.completedAt?.toISOString() ?? null;

    const [actorIsSuperAdmin, targetStaffGrant] = await Promise.all([
      userIsActiveSuperAdmin(this.db, actorUserId),
      this.db.platformStaffGrant.findFirst({
        where: { userId: user.id, revokedAt: null },
        select: { id: true },
      }),
    ]);
    const accountModeration = resolveAccountModerationCapabilities({
      actorUserId,
      actorIsSuperAdmin,
      target: {
        userId: user.id,
        accountStatus: user.accountStatus,
        deletedAt: user.deletedAt,
      },
      targetHasActiveStaffGrant: targetStaffGrant !== null,
    });

    return {
      userId: user.id,
      displayName: resolveIdentityReviewDisplayName(user.profile),
      maskedEmail: maskEmail(user.email),
      maskedPhone: user.phoneE164 ? maskPhoneE164(user.phoneE164) : null,
      hasAvatar: profileHasAvatar(user.profile),
      username: user.profile?.username?.trim() || null,
      bio: user.profile?.bio?.trim() || null,
      profileSummary: {
        locationCity: user.profile?.locationCity ?? null,
        locationRegion: user.profile?.locationRegion ?? null,
        scheduleTimeZone: user.profile?.scheduleTimeZone ?? null,
        profileVisibility: user.profile?.profileVisibility ?? null,
      },
      accountStatus: user.accountStatus,
      suspendedAt: user.suspendedAt?.toISOString() ?? null,
      emailVerified: user.emailVerifiedAt !== null,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      phoneVerified: user.phoneVerifiedAt !== null,
      phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
      ageEligibilityStatus: user.ageEligibilityStatus,
      identityVerificationStatus: user.identityVerificationStatus,
      adminReviewStatus: user.adminReviewStatus,
      registeredAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      providerIdentityApprovedAt: user.identityVerificationApprovedAt?.toISOString() ?? null,
      identityValidUntil: user.identityVerificationValidUntil?.toISOString() ?? null,
      identityRevokedAt: user.identityVerificationRevokedAt?.toISOString() ?? null,
      adminReviewDecidedAt: user.adminReviewDecidedAt?.toISOString() ?? null,
      providerSessionCompletedAt: providerCompletedAt,
      verificationSession: session
        ? {
            sessionId: session.id,
            status: session.status,
            provider: session.provider,
            completedAt: session.completedAt?.toISOString() ?? null,
            expiresAt: session.sessionExpiresAt.toISOString(),
            updatedAt: session.updatedAt.toISOString(),
          }
        : null,
      recentDecisions: recentDecisions.map((d) => ({
        decisionId: d.id,
        status: d.status,
        reasonCode: d.reasonCode,
        verificationSessionId: d.verificationSessionId,
        reviewerUserId: d.reviewerUserId,
        createdAt: d.createdAt.toISOString(),
      })),
      accountModeration,
    };
  }
}
