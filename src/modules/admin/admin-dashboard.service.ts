import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import {
  compareDashboardEventsNewestFirst,
  cursorWhere,
  dashboardEventsFilterFingerprint,
  decodeDashboardEventsCursor,
  encodeDashboardEventsCursor,
  presentAccountModerationEvent,
  presentActivityModerationEvent,
  presentIdentityReviewEvent,
  sourcesForEventCategory,
  UNSUPPORTED_DASHBOARD_EVENT_FEEDS,
  type DashboardEventCategory,
  type DashboardEventSource,
  type DashboardRecentEvent,
} from "./admin-dashboard-events.js";
import {
  buildDashboardExportCsv,
  buildDashboardExportFilename,
  type DashboardExportCsvRow,
} from "./admin-dashboard-export.js";
import {
  countByBucket,
  DASHBOARD_GROWTH_SAMPLE_CAP,
  DASHBOARD_TIMEZONE,
  enumerateBuckets,
  formatBucketLabel,
  percentChange,
  resolveDashboardRange,
  runningTotal,
  type DashboardRangeId,
} from "./admin-dashboard-range.js";
import { IdentityAdminReviewService } from "./identity-admin-review.service.js";
import { profileHasAvatar, resolveIdentityReviewDisplayName } from "./identity-review-profile.js";

const PREMIUM_UNAVAILABLE = {
  available: false as const,
  key: "premium",
  label: "Premium",
  reason:
    "No authoritative membership or subscription purchase records exist. The membership catalog is read-only and billing is deferred.",
  trackerId: "BE-061",
};

const REVENUE_UNAVAILABLE = {
  available: false as const,
  key: "revenue",
  label: "Revenue",
  reason:
    "No settled payment or order ledger exists. Checkout and Club billing are not live, so monthly revenue and MRR cannot be reported.",
  trackerId: "BE-062",
};

const RETENTION_UNAVAILABLE = {
  available: false as const,
  key: "activeUsers",
  label: "Active users",
  reason:
    "User last-active and retention telemetry is not stored. Session and device last-seen fields are not a product DAU/MAU signal.",
  trackerId: "BE-063",
};

export class AdminDashboardService {
  private readonly reviews: IdentityAdminReviewService;

  constructor(
    private readonly db: DatabaseClient,
    env: AppEnv,
  ) {
    this.reviews = new IdentityAdminReviewService(this.db, env);
  }

  async getOverview(rangeId: DashboardRangeId) {
    const now = new Date();
    const earliest = await this.earliestUserCreatedAt();
    const range = resolveDashboardRange({ range: rangeId, now, earliestRecordAt: earliest });
    const createdInRange = { gte: range.from, lt: range.to };
    const createdInPrevious =
      range.previousFrom && range.previousTo
        ? { gte: range.previousFrom, lt: range.previousTo }
        : null;

    const [
      totalUsers,
      activeAccounts,
      identityApproved,
      homeAccessApproved,
      usersCreatedInRange,
      usersCreatedPrevious,
      identityApprovedInRange,
      identityApprovedPrevious,
      activityGrouped,
      activitiesCreatedInRange,
      reviewSummary,
    ] = await Promise.all([
      this.db.user.count({ where: { deletedAt: null } }),
      this.db.user.count({ where: { deletedAt: null, accountStatus: "ACTIVE" } }),
      this.db.user.count({
        where: { deletedAt: null, identityVerificationStatus: "APPROVED" },
      }),
      this.db.user.count({ where: { deletedAt: null, adminReviewStatus: "APPROVED" } }),
      this.db.user.count({ where: { deletedAt: null, createdAt: createdInRange } }),
      createdInPrevious
        ? this.db.user.count({ where: { deletedAt: null, createdAt: createdInPrevious } })
        : Promise.resolve(null),
      this.db.user.count({
        where: {
          deletedAt: null,
          identityVerificationStatus: "APPROVED",
          identityVerificationApprovedAt: createdInRange,
        },
      }),
      createdInPrevious
        ? this.db.user.count({
            where: {
              deletedAt: null,
              identityVerificationStatus: "APPROVED",
              identityVerificationApprovedAt: createdInPrevious,
            },
          })
        : Promise.resolve(null),
      this.db.activity.groupBy({ by: ["status"], _count: { _all: true } }),
      this.db.activity.count({ where: { createdAt: createdInRange } }),
      this.reviews.getReviewSummary(),
    ]);

    let totalActivities = 0;
    let published = 0;
    for (const row of activityGrouped) {
      totalActivities += row._count._all;
      if (row.status === "PUBLISHED") {
        published = row._count._all;
      }
    }

    const signupDelta =
      usersCreatedPrevious === null
        ? null
        : percentChange(usersCreatedInRange, usersCreatedPrevious);
    const verifiedDelta =
      identityApprovedPrevious === null
        ? null
        : percentChange(identityApprovedInRange, identityApprovedPrevious);

    return {
      generatedAt: now.toISOString(),
      timezone: DASHBOARD_TIMEZONE,
      refreshMode: "ON_DEMAND" as const,
      realtimePush: false,
      range: serializeRange(range),
      kpis: {
        totalUsers: {
          available: true as const,
          key: "totalUsers",
          label: "Total Users",
          value: totalUsers,
          definition: "Count of registered users with deletedAt IS NULL.",
          source: "User.createdAt / User.deletedAt",
          secondary: {
            label: "New in selected range",
            value: usersCreatedInRange,
          },
          trend: trendFromDelta(signupDelta, usersCreatedInRange, usersCreatedPrevious),
        },
        activeAccounts: {
          available: true as const,
          key: "activeAccounts",
          label: "Active Accounts",
          value: activeAccounts,
          definition:
            "Non-deleted users whose accountStatus is ACTIVE. This is not DAU or MAU — last-active telemetry is not stored.",
          source: "User.accountStatus",
          secondary: {
            label: "Not a DAU/MAU metric",
            value: null,
          },
          trend: { available: false as const, reason: RETENTION_UNAVAILABLE.reason },
        },
        verified: {
          available: true as const,
          key: "verified",
          label: "Identity Approved",
          value: identityApproved,
          definition:
            "Users with identityVerificationStatus=APPROVED (Step A identity). Distinct from platform Home access.",
          source: "User.identityVerificationStatus",
          secondary: {
            label: "Home access approved",
            value: homeAccessApproved,
          },
          trend: trendFromDelta(verifiedDelta, identityApprovedInRange, identityApprovedPrevious),
        },
        premium: PREMIUM_UNAVAILABLE,
        revenue: REVENUE_UNAVAILABLE,
        activities: {
          available: true as const,
          key: "activities",
          label: "Activities",
          value: totalActivities,
          definition: "All persisted Activity rows, all lifecycle states.",
          source: "Activity.status / Activity.createdAt",
          secondary: {
            label: "Published now",
            value: published,
          },
          inRange: {
            label: "Created in selected range",
            value: activitiesCreatedInRange,
          },
        },
        pendingModeration: {
          available: true as const,
          key: "pendingModeration",
          label: "Pending Reviews",
          value: reviewSummary.pendingActionable,
          definition:
            "Actionable identity queue: manual Step A IN_REVIEW plus Step B platform PENDING. Severity (urgent/high) is not stored.",
          source: "User.adminReviewStatus + manual identity eligibility",
          warning: reviewSummary.pendingActionable > 0,
          secondary: {
            label: "On hold",
            value: reviewSummary.pendingOnHold,
          },
        },
      },
      unsupported: [PREMIUM_UNAVAILABLE, REVENUE_UNAVAILABLE, RETENTION_UNAVAILABLE],
    };
  }

  async getGrowth(rangeId: DashboardRangeId) {
    const now = new Date();
    const earliest = await this.earliestUserCreatedAt();
    const range = resolveDashboardRange({ range: rangeId, now, earliestRecordAt: earliest });
    const buckets = enumerateBuckets({
      from: range.from,
      to: range.to,
      granularity: range.granularity,
    });

    const [baseline, createdRows] = await Promise.all([
      this.db.user.count({
        where: { deletedAt: null, createdAt: { lt: range.from } },
      }),
      this.db.user.findMany({
        where: { deletedAt: null, createdAt: { gte: range.from, lt: range.to } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
        take: DASHBOARD_GROWTH_SAMPLE_CAP + 1,
      }),
    ]);

    const truncatedSample = createdRows.length > DASHBOARD_GROWTH_SAMPLE_CAP;
    const sample = truncatedSample
      ? createdRows.slice(0, DASHBOARD_GROWTH_SAMPLE_CAP)
      : createdRows;
    const periodCounts = countByBucket(
      sample.map((row) => row.createdAt),
      buckets,
      range.granularity,
    );
    const cumulative = runningTotal(baseline, periodCounts);
    const totalInRange = periodCounts.reduce((sum, n) => sum + n, 0);

    return {
      generatedAt: now.toISOString(),
      timezone: DASHBOARD_TIMEZONE,
      range: serializeRange(range),
      granularity: range.granularity,
      partialHistory: range.truncatedFromHistory || truncatedSample,
      sampleCapped: truncatedSample,
      series: {
        signups: {
          available: true as const,
          label: "Signups",
          kind: "PERIOD_COUNT" as const,
          totalInRange,
          baselineBeforeRange: baseline,
          points: buckets.map((bucket, index) => ({
            bucketStart: bucket.toISOString(),
            label: formatBucketLabel(bucket, range.granularity),
            periodCount: periodCounts[index] ?? 0,
            cumulativeCount: cumulative[index] ?? baseline,
          })),
        },
        activeUsers: RETENTION_UNAVAILABLE,
      },
    };
  }

  async getActivityCategories(rangeId: DashboardRangeId, limit: number) {
    const now = new Date();
    const earliest = await this.earliestUserCreatedAt();
    const range = resolveDashboardRange({ range: rangeId, now, earliestRecordAt: earliest });
    const activityWhere =
      rangeId === "all_time" ? {} : { createdAt: { gte: range.from, lt: range.to } };

    const [categories, grouped] = await Promise.all([
      this.db.activityCategory.findMany({
        orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
        select: { id: true, slug: true, label: true, sortOrder: true },
      }),
      this.db.activity.groupBy({
        by: ["categoryId"],
        where: activityWhere,
        _count: { _all: true },
      }),
    ]);

    const countByCategory = new Map(grouped.map((row) => [row.categoryId, row._count._all]));
    const totalActivities = grouped.reduce((sum, row) => sum + row._count._all, 0);

    const confirmedByCategory = await Promise.all(
      categories.map((category) =>
        this.db.activityParticipation.count({
          where: {
            state: "CONFIRMED",
            activity: {
              categoryId: category.id,
              ...(rangeId === "all_time" ? {} : activityWhere),
            },
          },
        }),
      ),
    );

    const ranked = categories
      .map((category, index) => {
        const activityCount = countByCategory.get(category.id) ?? 0;
        const confirmedParticipations = confirmedByCategory[index] ?? 0;
        const sharePercent =
          totalActivities > 0 ? Math.round((activityCount / totalActivities) * 1000) / 10 : 0;
        return {
          slug: category.slug,
          label: category.label,
          sortOrder: category.sortOrder,
          activityCount,
          confirmedParticipations,
          sharePercent,
          supportingText:
            confirmedParticipations === 1
              ? "1 confirmed RSVP"
              : `${confirmedParticipations} confirmed RSVPs`,
        };
      })
      .sort((a, b) => {
        if (b.activityCount !== a.activityCount) {
          return b.activityCount - a.activityCount;
        }
        return a.sortOrder - b.sortOrder;
      });

    const visible = ranked.slice(0, limit);
    return {
      generatedAt: now.toISOString(),
      timezone: DASHBOARD_TIMEZONE,
      range: serializeRange(range),
      denominator: "ACTIVITY_SHARE" as const,
      denominatorLabel:
        rangeId === "all_time"
          ? "Share of all persisted activities"
          : "Share of activities created in the selected range",
      totalActivities,
      categories: visible.map(({ sortOrder: _sortOrder, ...rest }) => rest),
      hasMore: ranked.length > visible.length,
      remainingCount: Math.max(0, ranked.length - visible.length),
    };
  }

  async getVerificationQueue(limit: number) {
    const [summary, listed] = await Promise.all([
      this.reviews.getReviewSummary(),
      this.reviews.listReviews({
        status: "PENDING",
        posture: "actionable",
        limit,
      }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      pendingActionable: summary.pendingActionable,
      pendingOnHold: summary.pendingOnHold,
      pendingTotal: summary.pendingTotal,
      items: listed.reviews.map((review) => ({
        reviewId: review.reviewId,
        displayName: review.displayName,
        hasAvatar: review.hasAvatar,
        pendingReviewStage: review.pendingReviewStage,
        pendingReviewLabel: review.pendingReviewLabel,
        submittedAt: review.submittedAt,
        href: `/verification/${review.reviewId}`,
      })),
    };
  }

  async getRecentEvents(input: {
    category: DashboardEventCategory;
    limit: number;
    cursor?: string;
  }) {
    const generatedAt = new Date().toISOString();
    const unsupported =
      input.category === "all" || input.category === "verifications"
        ? null
        : UNSUPPORTED_DASHBOARD_EVENT_FEEDS[input.category];
    if (unsupported) {
      return {
        generatedAt,
        category: input.category,
        available: false as const,
        reason: unsupported.reason,
        trackerId: unsupported.trackerId,
        events: [] as DashboardRecentEvent[],
        nextCursor: null,
      };
    }

    const sources = sourcesForEventCategory(input.category) ?? [];
    const fingerprint = dashboardEventsFilterFingerprint(input.category);
    const cursor = decodeDashboardEventsCursor(input.cursor, fingerprint);
    const take = input.limit + 1;
    const whereCursor = cursorWhere(cursor);

    const [identityRows, accountRows, activityRows] = await Promise.all([
      sources.includes("IDENTITY_REVIEW")
        ? this.db.identityAdminReviewDecision.findMany({
            where: whereCursor,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take,
            select: {
              id: true,
              userId: true,
              status: true,
              createdAt: true,
              user: {
                select: {
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
          })
        : Promise.resolve([]),
      sources.includes("ACCOUNT_MODERATION")
        ? this.db.accountModerationDecision.findMany({
            where: whereCursor,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take,
            select: {
              id: true,
              userId: true,
              action: true,
              resultingAccountStatus: true,
              createdAt: true,
              user: {
                select: {
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
          })
        : Promise.resolve([]),
      sources.includes("ACTIVITY_MODERATION")
        ? this.db.activityModerationDecision.findMany({
            where: whereCursor,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take,
            select: {
              id: true,
              activityId: true,
              action: true,
              createdAt: true,
              activity: { select: { title: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const merged: Array<
      DashboardRecentEvent & {
        occurredAtDate: Date;
        source: DashboardEventSource;
      }
    > = [
      ...identityRows.map((row) => {
        const event = presentIdentityReviewEvent({
          id: row.id,
          userId: row.userId,
          status: row.status,
          createdAt: row.createdAt,
          displayName: resolveIdentityReviewDisplayName(row.user.profile),
          hasAvatar: profileHasAvatar(row.user.profile),
        });
        return { ...event, occurredAtDate: row.createdAt, source: event.source };
      }),
      ...accountRows.map((row) => {
        const event = presentAccountModerationEvent({
          id: row.id,
          userId: row.userId,
          action: row.action,
          resultingAccountStatus: row.resultingAccountStatus,
          createdAt: row.createdAt,
          displayName: resolveIdentityReviewDisplayName(row.user.profile),
          hasAvatar: profileHasAvatar(row.user.profile),
        });
        return { ...event, occurredAtDate: row.createdAt, source: event.source };
      }),
      ...activityRows.map((row) => {
        const event = presentActivityModerationEvent({
          id: row.id,
          activityId: row.activityId,
          action: row.action,
          createdAt: row.createdAt,
          title: row.activity.title,
        });
        return { ...event, occurredAtDate: row.createdAt, source: event.source };
      }),
    ];

    merged.sort((a, b) =>
      compareDashboardEventsNewestFirst(
        { occurredAt: a.occurredAtDate, eventId: a.eventId, source: a.source },
        { occurredAt: b.occurredAtDate, eventId: b.eventId, source: b.source },
      ),
    );

    const page = merged.slice(0, input.limit);
    const next = merged.length > input.limit ? merged[input.limit] : null;
    const nextCursor = next
      ? encodeDashboardEventsCursor({
          occurredAt: next.occurredAtDate,
          eventId: next.eventId,
          source: next.source,
          filterFingerprint: fingerprint,
        })
      : null;

    return {
      generatedAt,
      category: input.category,
      available: true as const,
      events: page.map(({ occurredAtDate: _d, ...event }) => event),
      nextCursor,
    };
  }

  async exportOverviewCsv(rangeId: DashboardRangeId) {
    const [overview, growth, categories, queue] = await Promise.all([
      this.getOverview(rangeId),
      this.getGrowth(rangeId),
      this.getActivityCategories(rangeId, 12),
      this.getVerificationQueue(5),
    ]);
    const generatedAt = new Date(overview.generatedAt);
    const period = overview.range.label;
    const rows: DashboardExportCsvRow[] = [];

    const push = (
      section: string,
      metric: string,
      label: string,
      value: string,
      status: string,
      definition: string,
    ) => {
      rows.push({ section, metric, label, value, status, definition, period });
    };

    push(
      "meta",
      "generated_at",
      "Generated at",
      overview.generatedAt,
      "available",
      "UTC snapshot. Refresh is on-demand polling, not realtime push.",
    );
    push(
      "meta",
      "timezone",
      "Timezone",
      overview.timezone,
      "available",
      "Calendar buckets use UTC.",
    );
    push(
      "meta",
      "range",
      overview.range.label,
      `${overview.range.from}/${overview.range.to}`,
      "available",
      "Inclusive UTC window used for period deltas and growth.",
    );

    const kpis = overview.kpis;
    push(
      "kpi",
      "total_users",
      kpis.totalUsers.label,
      String(kpis.totalUsers.value),
      "available",
      kpis.totalUsers.definition,
    );
    push(
      "kpi",
      "active_accounts",
      kpis.activeAccounts.label,
      String(kpis.activeAccounts.value),
      "available",
      kpis.activeAccounts.definition,
    );
    push(
      "kpi",
      "identity_approved",
      kpis.verified.label,
      String(kpis.verified.value),
      "available",
      kpis.verified.definition,
    );
    push(
      "kpi",
      "home_access_approved",
      "Home access approved",
      String(kpis.verified.secondary.value),
      "available",
      "Users with adminReviewStatus=APPROVED.",
    );
    push("kpi", "premium", kpis.premium.label, "", "unavailable", kpis.premium.reason);
    push("kpi", "revenue", kpis.revenue.label, "", "unavailable", kpis.revenue.reason);
    push(
      "kpi",
      "activities",
      kpis.activities.label,
      String(kpis.activities.value),
      "available",
      kpis.activities.definition,
    );
    push(
      "kpi",
      "pending_reviews",
      kpis.pendingModeration.label,
      String(kpis.pendingModeration.value),
      "available",
      kpis.pendingModeration.definition,
    );

    if (growth.series.signups.available) {
      push(
        "growth",
        "signups_in_range",
        "Signups in range",
        String(growth.series.signups.totalInRange),
        "available",
        "Per-period User.createdAt counts in UTC buckets.",
      );
    }
    push(
      "growth",
      "active_users_series",
      RETENTION_UNAVAILABLE.label,
      "",
      "unavailable",
      RETENTION_UNAVAILABLE.reason,
    );

    for (const category of categories.categories) {
      push(
        "activity_category",
        category.slug,
        category.label,
        String(category.activityCount),
        "available",
        `${category.sharePercent}% ${categories.denominatorLabel}; ${category.supportingText}`,
      );
    }

    push(
      "verification_queue",
      "pending_actionable",
      "Actionable reviews",
      String(queue.pendingActionable),
      "available",
      "Manual Step A plus platform Step B actionable queue.",
    );

    return {
      csv: buildDashboardExportCsv(rows),
      filename: buildDashboardExportFilename(rangeId, generatedAt),
      rowCount: rows.length,
    };
  }

  private async earliestUserCreatedAt(): Promise<Date | null> {
    const row = await this.db.user.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    return row?.createdAt ?? null;
  }
}

function serializeRange(range: ReturnType<typeof resolveDashboardRange>) {
  return {
    id: range.id,
    label: range.label,
    timezone: range.timezone,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    previousFrom: range.previousFrom?.toISOString() ?? null,
    previousTo: range.previousTo?.toISOString() ?? null,
    granularity: range.granularity,
    truncatedFromHistory: range.truncatedFromHistory,
  };
}

function trendFromDelta(
  delta: number | null,
  current: number,
  previous: number | null,
):
  | {
      available: true;
      direction: "up" | "down" | "flat";
      deltaPercent: number;
      currentPeriodValue: number;
      previousPeriodValue: number | null;
      label: string;
    }
  | { available: false; reason: string } {
  if (delta === null || previous === null) {
    return {
      available: false,
      reason: "No equal-length prior period exists for this range.",
    };
  }
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const sign = delta > 0 ? "+" : "";
  return {
    available: true,
    direction,
    deltaPercent: delta,
    currentPeriodValue: current,
    previousPeriodValue: previous,
    label: `${sign}${delta}% vs prior period`,
  };
}
