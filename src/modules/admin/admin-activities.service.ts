import type {
  ActivityAudience,
  ActivityMode,
  ActivityParticipationState,
  ActivityStatus,
} from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { ActivityCoverStorage } from "../activities/activity-cover.storage.js";
import { profileHasAvatar, resolveIdentityReviewDisplayName } from "./identity-review-profile.js";
import {
  ADMIN_ACTIVITIES_EXPORT_MAX_ROWS,
  buildAdminActivitiesExportCsv,
  buildAdminActivitiesExportFilename,
  type AdminActivityExportCsvRow,
} from "./admin-activities-csv.js";
import {
  ADMIN_ACTIVITIES_LOCATION_CATALOG_LIMIT,
  ADMIN_ACTIVITY_ROSTER_LIMIT,
  formatLocationSummary,
  resolveActivitySchedulePhase,
  upcomingWindowEnd,
} from "./admin-activities-presentation.js";
import {
  buildAdminActivitiesFilterFingerprint,
  buildAdminActivitiesListWhere,
  decodeListCursor,
  encodeListCursor,
  type AdminActivitiesListFilters,
} from "./admin-activities-list-query.js";
import { resolveActivityCancellationCapabilities } from "./admin-activity-cancellation.policy.js";
import { userIsActiveSuperAdmin } from "./platform-staff-policy.js";

const PARTICIPATION_TALLY_STATES: ActivityParticipationState[] = [
  "CONFIRMED",
  "WAITLISTED",
  "PENDING",
];

const UNSUPPORTED_LIFECYCLE_CARDS = {
  pendingApproval: {
    available: false as const,
    reason: "No pending-approval activity lifecycle state exists.",
  },
  suspended: {
    available: false as const,
    reason: "No suspended activity lifecycle state exists.",
  },
};

const DETAIL_UNAVAILABLE = {
  pricing: "Admission and pricing are not stored on activities.",
  preciseLocation:
    "Exact meetup addresses, coordinates, and private join details are not exposed to Admin staff.",
  map: "No authorized coordinates are stored.",
  gpsVerification: "GPS verification evidence is not stored.",
  tags: "Activity tags are not stored beyond the category.",
  createdSource: "Creation source (web, app, or API) is not persisted.",
  auditHistory: "No server-side activity audit log exists.",
  safetyReports: "Activity safety reports are not stored.",
  riskScore: "Risk scores and trust indexes are not stored.",
  hostReviews: "Host review ratings are not stored.",
  moderationActions: "Edit, suspend, and delete are not authorized in this task.",
  cancelNotifications:
    "Host and participant notifications are not sent. Cancellation updates stored records only.",
};

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

function emptyStatusCounts() {
  return {
    draft: 0,
    published: 0,
    cancelled: 0,
    completed: 0,
  };
}

function emptyTallies() {
  return { confirmed: 0, waitlisted: 0, pending: 0 };
}

export class AdminActivitiesService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly activityCoverStorage?: ActivityCoverStorage,
  ) {}

  async getActivitiesSummary() {
    const now = new Date();
    const upcomingEnd = upcomingWindowEnd(now);
    const [grouped, categories, locations, activeNow, upcomingNext14Days] = await Promise.all([
      this.db.activity.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      this.db.activityCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
        select: { slug: true, label: true },
      }),
      this.db.activity.findMany({
        where: { locationCity: { not: null } },
        distinct: ["locationCity", "locationRegion"],
        select: { locationCity: true, locationRegion: true },
        orderBy: [{ locationCity: "asc" }, { locationRegion: "asc" }],
        take: ADMIN_ACTIVITIES_LOCATION_CATALOG_LIMIT,
      }),
      this.db.activity.count({
        where: {
          status: "PUBLISHED",
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
      }),
      this.db.activity.count({
        where: {
          status: "PUBLISHED",
          startsAt: { gt: now, lte: upcomingEnd },
        },
      }),
    ]);

    const counts = emptyStatusCounts();
    let totalActivities = 0;
    for (const row of grouped) {
      totalActivities += row._count._all;
      if (row.status === "DRAFT") {
        counts.draft = row._count._all;
      } else if (row.status === "PUBLISHED") {
        counts.published = row._count._all;
      } else if (row.status === "CANCELLED") {
        counts.cancelled = row._count._all;
      } else if (row.status === "COMPLETED") {
        counts.completed = row._count._all;
      }
    }

    return {
      scope: "GLOBAL_ACTIVITY_TOTALS" as const,
      totalActivities,
      ...counts,
      scheduleWindows: {
        activeNow,
        upcomingNext14Days,
      },
      unsupportedLifecycleCards: UNSUPPORTED_LIFECYCLE_CARDS,
      categories,
      locations: locations
        .map((row) => {
          const city = row.locationCity?.trim() || null;
          const region = row.locationRegion?.trim() || null;
          const label = formatLocationSummary(city, region);
          if (!city || !label) {
            return null;
          }
          return { city, region, label };
        })
        .filter(
          (row): row is { city: string; region: string | null; label: string } => row !== null,
        ),
    };
  }

  async listActivities(input: {
    limit: number;
    cursor?: string;
    q?: string;
    status?: ActivityStatus;
    mode?: ActivityMode;
    audience?: ActivityAudience;
    category?: string;
    location?: string;
    month?: string;
    when?: AdminActivitiesListFilters["when"];
  }) {
    const filters: AdminActivitiesListFilters = {
      q: input.q,
      status: input.status,
      mode: input.mode,
      audience: input.audience,
      category: input.category,
      location: input.location,
      month: input.month,
      when: input.when,
    };
    const filterFingerprint = buildAdminActivitiesFilterFingerprint(filters);
    const cursor = decodeListCursor(input.cursor, filterFingerprint);
    const now = new Date();

    const baseWhere = buildAdminActivitiesListWhere(filters, now);
    const andParts = Array.isArray(baseWhere.AND)
      ? [...baseWhere.AND]
      : Object.keys(baseWhere).length > 0
        ? [baseWhere]
        : [];
    if (cursor) {
      andParts.push({
        OR: [
          { startsAt: { lt: cursor.updatedAt } },
          {
            AND: [{ startsAt: cursor.updatedAt }, { id: { lt: cursor.userId } }],
          },
        ],
      });
    }

    const listWhere = andParts.length > 0 ? { AND: andParts } : undefined;
    const take = input.limit + 1;
    const [rows, totalMatching] = await Promise.all([
      this.db.activity.findMany({
        where: listWhere,
        orderBy: [{ startsAt: "desc" }, { id: "desc" }],
        take,
        select: listSelect,
      }),
      this.db.activity.count({ where: baseWhere }),
    ]);

    const page = rows.slice(0, input.limit);
    const nextCursor =
      rows.length > input.limit && page.length > 0
        ? encodeListCursor({
            updatedAt: page[page.length - 1].startsAt,
            userId: page[page.length - 1].id,
            filterFingerprint,
          })
        : null;

    const tallies = await this.loadParticipationTallies(page.map((row) => row.id));
    const hostedCounts = await this.loadHostedCounts(page.map((row) => row.host.id));

    return {
      activities: page.map((row) => this.toListItem(row, tallies, hostedCounts, now)),
      nextCursor,
      totalMatching,
      filterFingerprint,
    };
  }

  async exportActivitiesCsv(input: {
    q?: string;
    status?: ActivityStatus;
    mode?: ActivityMode;
    audience?: ActivityAudience;
    category?: string;
    location?: string;
    month?: string;
    when?: AdminActivitiesListFilters["when"];
  }) {
    const filters: AdminActivitiesListFilters = {
      q: input.q,
      status: input.status,
      mode: input.mode,
      audience: input.audience,
      category: input.category,
      location: input.location,
      month: input.month,
      when: input.when,
    };
    const now = new Date();
    const baseWhere = buildAdminActivitiesListWhere(filters, now);
    const rows = await this.db.activity.findMany({
      where: baseWhere,
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      take: ADMIN_ACTIVITIES_EXPORT_MAX_ROWS + 1,
      select: listSelect,
    });
    const truncated = rows.length > ADMIN_ACTIVITIES_EXPORT_MAX_ROWS;
    const page = rows.slice(0, ADMIN_ACTIVITIES_EXPORT_MAX_ROWS);
    const tallies = await this.loadParticipationTallies(page.map((row) => row.id));
    const hostedCounts = await this.loadHostedCounts(page.map((row) => row.host.id));

    const csvRows: AdminActivityExportCsvRow[] = page.map((row) => {
      const item = this.toListItem(row, tallies, hostedCounts, now);
      return {
        activity_id: item.activityId,
        title: item.title,
        status: item.status,
        mode: item.mode,
        audience: item.audience,
        category: item.categoryLabel,
        location_summary: item.locationSummary ?? "",
        venue_name: item.venueName ?? "",
        starts_at: item.startsAt,
        ends_at: item.endsAt,
        time_zone: item.timeZone,
        capacity: String(item.capacity),
        confirmed_count: String(item.confirmedCount),
        waitlisted_count: String(item.waitlistedCount),
        pending_join_count: String(item.pendingJoinCount),
        host_user_id: item.host.userId,
        host_display_name: item.host.displayName ?? "",
        host_masked_email: item.host.maskedEmail,
        created_at: item.createdAt,
      };
    });

    return {
      csv: buildAdminActivitiesExportCsv({ rows: csvRows, truncated }),
      filename: buildAdminActivitiesExportFilename(),
      rowCount: csvRows.length,
      truncated,
      maxRows: ADMIN_ACTIVITIES_EXPORT_MAX_ROWS,
      filterFingerprint: buildAdminActivitiesFilterFingerprint(filters),
    };
  }

  async getActivityDetail(activityId: string, actorUserId: string) {
    const now = new Date();
    const row = await this.db.activity.findUnique({
      where: { id: activityId },
      select: {
        ...listSelect,
        description: true,
        skillNotes: true,
        gearNotes: true,
        updatedAt: true,
        host: {
          select: {
            id: true,
            email: true,
            accountStatus: true,
            createdAt: true,
            identityVerificationStatus: true,
            profile: {
              select: {
                displayName: true,
                firstName: true,
                lastName: true,
                username: true,
                avatarStorageKey: true,
              },
            },
          },
        },
      },
    });
    if (!row) {
      throw new AppError("NOT_FOUND", "Activity not found", 404);
    }

    const [tallies, hostedMetrics, rosterRows, actorIsSuperAdmin] = await Promise.all([
      this.loadParticipationTallies([row.id]),
      this.loadHostMetrics(row.host.id),
      this.db.activityParticipation.findMany({
        where: { activityId: row.id, state: "CONFIRMED" },
        orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
        take: ADMIN_ACTIVITY_ROSTER_LIMIT + 1,
        select: {
          joinedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  displayName: true,
                  firstName: true,
                  lastName: true,
                  avatarStorageKey: true,
                },
              },
            },
          },
        },
      }),
      userIsActiveSuperAdmin(this.db, actorUserId),
    ]);

    const cancellation = resolveActivityCancellationCapabilities({
      actorUserId,
      actorIsSuperAdmin,
      target: {
        activityId: row.id,
        hostId: row.host.id,
        status: row.status,
      },
    });

    const counts = tallies.get(row.id) ?? emptyTallies();
    const rosterTruncated = rosterRows.length > ADMIN_ACTIVITY_ROSTER_LIMIT;
    const roster = rosterRows.slice(0, ADMIN_ACTIVITY_ROSTER_LIMIT);

    return {
      activityId: row.id,
      title: row.title,
      description: row.description?.trim() || null,
      skillNotes: row.skillNotes?.trim() || null,
      gearNotes: row.gearNotes?.trim() || null,
      status: row.status,
      mode: row.mode,
      audience: row.audience,
      joinMode: row.joinMode,
      categorySlug: row.category.slug,
      categoryLabel: row.category.label,
      locationSummary: formatLocationSummary(row.locationCity, row.locationRegion),
      venueName: row.venueName?.trim() || null,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      timeZone: row.timeZone,
      schedulePhase: resolveActivitySchedulePhase(row.startsAt, row.endsAt, now),
      capacity: row.capacity,
      waitlistEnabled: row.waitlistEnabled,
      confirmedCount: counts.confirmed,
      waitlistedCount: counts.waitlisted,
      pendingJoinCount: counts.pending,
      hasCover: Boolean(row.coverStorageKey),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      host: {
        userId: row.host.id,
        displayName: resolveIdentityReviewDisplayName(row.host.profile),
        username: row.host.profile?.username?.trim() || null,
        maskedEmail: maskEmail(row.host.email),
        hasAvatar: profileHasAvatar(row.host.profile),
        accountStatus: row.host.accountStatus,
        identityVerificationStatus: row.host.identityVerificationStatus,
        registeredAt: row.host.createdAt.toISOString(),
        hostedCount: hostedMetrics.hostedCount,
        hostedCompletedCount: hostedMetrics.hostedCompletedCount,
        hostedCancelledCount: hostedMetrics.hostedCancelledCount,
      },
      participants: {
        confirmed: roster.map((entry) => ({
          userId: entry.user.id,
          displayName: resolveIdentityReviewDisplayName(entry.user.profile),
          maskedEmail: maskEmail(entry.user.email),
          hasAvatar: profileHasAvatar(entry.user.profile),
          joinedAt: entry.joinedAt.toISOString(),
        })),
        rosterLimit: ADMIN_ACTIVITY_ROSTER_LIMIT,
        rosterTruncated,
      },
      cancellation,
      capabilities: {
        canEdit: false,
        canSuspend: false,
        canCancel: cancellation.canCancel,
        canDelete: false,
        coverAvailable: Boolean(row.coverStorageKey),
        auditHistoryAvailable: false,
        safetyReportsAvailable: false,
        pricingAvailable: false,
        preciseLocationAvailable: false,
        mapAvailable: false,
        gpsVerificationAvailable: false,
        tagsAvailable: false,
        createdSourceAvailable: false,
      },
      unavailable: DETAIL_UNAVAILABLE,
    };
  }

  async getCoverBytes(activityId: string): Promise<{ buffer: Buffer; contentType: string }> {
    if (!this.activityCoverStorage) {
      throw new AppError("SERVICE_UNAVAILABLE", "Activity cover storage is not configured", 503);
    }
    const row = await this.db.activity.findUnique({
      where: { id: activityId },
      select: {
        id: true,
        hostId: true,
        coverStorageKey: true,
        coverContentType: true,
      },
    });
    if (!row) {
      throw new AppError("NOT_FOUND", "Activity not found", 404);
    }
    if (!row.coverStorageKey || !row.coverContentType) {
      throw new AppError("NOT_FOUND", "Activity cover not found", 404);
    }
    this.activityCoverStorage.assertStorageKeyOwnedByHost(row.coverStorageKey, row.hostId);
    const buffer = await this.activityCoverStorage.readBytes(row.coverStorageKey, row.hostId);
    return { buffer, contentType: row.coverContentType };
  }

  private async loadParticipationTallies(activityIds: string[]) {
    const tallies = new Map<string, { confirmed: number; waitlisted: number; pending: number }>();
    if (activityIds.length === 0) {
      return tallies;
    }
    const grouped = await this.db.activityParticipation.groupBy({
      by: ["activityId", "state"],
      where: {
        activityId: { in: activityIds },
        state: { in: PARTICIPATION_TALLY_STATES },
      },
      _count: { _all: true },
    });
    for (const row of grouped) {
      const current = tallies.get(row.activityId) ?? emptyTallies();
      if (row.state === "CONFIRMED") {
        current.confirmed = row._count._all;
      } else if (row.state === "WAITLISTED") {
        current.waitlisted = row._count._all;
      } else if (row.state === "PENDING") {
        current.pending = row._count._all;
      }
      tallies.set(row.activityId, current);
    }
    return tallies;
  }

  private async loadHostedCounts(hostIds: string[]) {
    const counts = new Map<string, number>();
    const unique = [...new Set(hostIds)];
    if (unique.length === 0) {
      return counts;
    }
    const grouped = await this.db.activity.groupBy({
      by: ["hostId"],
      where: { hostId: { in: unique } },
      _count: { _all: true },
    });
    for (const row of grouped) {
      counts.set(row.hostId, row._count._all);
    }
    return counts;
  }

  private async loadHostMetrics(hostId: string) {
    const grouped = await this.db.activity.groupBy({
      by: ["status"],
      where: { hostId },
      _count: { _all: true },
    });
    let hostedCount = 0;
    let hostedCompletedCount = 0;
    let hostedCancelledCount = 0;
    for (const row of grouped) {
      hostedCount += row._count._all;
      if (row.status === "COMPLETED") {
        hostedCompletedCount = row._count._all;
      } else if (row.status === "CANCELLED") {
        hostedCancelledCount = row._count._all;
      }
    }
    return { hostedCount, hostedCompletedCount, hostedCancelledCount };
  }

  private toListItem(
    row: ListRow,
    tallies: Map<string, { confirmed: number; waitlisted: number; pending: number }>,
    hostedCounts: Map<string, number>,
    now: Date,
  ) {
    const counts = tallies.get(row.id) ?? emptyTallies();
    return {
      activityId: row.id,
      title: row.title,
      status: row.status,
      mode: row.mode,
      audience: row.audience,
      joinMode: row.joinMode,
      categorySlug: row.category.slug,
      categoryLabel: row.category.label,
      locationSummary: formatLocationSummary(row.locationCity, row.locationRegion),
      venueName: row.venueName?.trim() || null,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      timeZone: row.timeZone,
      schedulePhase: resolveActivitySchedulePhase(row.startsAt, row.endsAt, now),
      capacity: row.capacity,
      waitlistEnabled: row.waitlistEnabled,
      confirmedCount: counts.confirmed,
      waitlistedCount: counts.waitlisted,
      pendingJoinCount: counts.pending,
      hasCover: Boolean(row.coverStorageKey),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      host: {
        userId: row.host.id,
        displayName: resolveIdentityReviewDisplayName(row.host.profile),
        maskedEmail: maskEmail(row.host.email),
        hasAvatar: profileHasAvatar(row.host.profile),
        accountStatus: row.host.accountStatus,
        hostedCount: hostedCounts.get(row.host.id) ?? 0,
      },
    };
  }
}

const listSelect = {
  id: true,
  title: true,
  status: true,
  mode: true,
  audience: true,
  joinMode: true,
  capacity: true,
  waitlistEnabled: true,
  venueName: true,
  locationCity: true,
  locationRegion: true,
  startsAt: true,
  endsAt: true,
  timeZone: true,
  publishedAt: true,
  cancelledAt: true,
  createdAt: true,
  coverStorageKey: true,
  category: {
    select: { slug: true, label: true },
  },
  host: {
    select: {
      id: true,
      email: true,
      accountStatus: true,
      profile: {
        select: {
          displayName: true,
          firstName: true,
          lastName: true,
          avatarStorageKey: true,
        },
      },
    },
  },
} as const;

type ListRow = {
  id: string;
  title: string;
  status: ActivityStatus;
  mode: ActivityMode;
  audience: ActivityAudience;
  joinMode: string;
  capacity: number;
  waitlistEnabled: boolean;
  venueName: string | null;
  locationCity: string | null;
  locationRegion: string | null;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  publishedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  coverStorageKey: string | null;
  category: { slug: string; label: string };
  host: {
    id: string;
    email: string;
    accountStatus: string;
    profile: {
      displayName: string | null;
      firstName: string | null;
      lastName: string | null;
      avatarStorageKey: string | null;
    } | null;
  };
};
