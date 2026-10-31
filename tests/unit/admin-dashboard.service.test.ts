import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardService } from "../../src/modules/admin/admin-dashboard.service.js";
import { IdentityAdminReviewService } from "../../src/modules/admin/identity-admin-review.service.js";
import type { AppEnv } from "../../src/config/env.js";

function createDb() {
  return {
    user: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    activity: {
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    activityCategory: {
      findMany: vi.fn(),
    },
    activityParticipation: {
      count: vi.fn(),
    },
    identityAdminReviewDecision: {
      findMany: vi.fn(),
    },
    accountModerationDecision: {
      findMany: vi.fn(),
    },
    activityModerationDecision: {
      findMany: vi.fn(),
    },
  };
}

const env = { NODE_ENV: "test" } as AppEnv;

describe("AdminDashboardService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns honest KPI definitions and marks premium/revenue unavailable", async () => {
    const db = createDb();
    db.user.findFirst.mockResolvedValue({ createdAt: new Date("2026-01-01T00:00:00.000Z") });
    db.user.count
      .mockResolvedValueOnce(12) // total
      .mockResolvedValueOnce(7) // active accounts
      .mockResolvedValueOnce(5) // identity approved
      .mockResolvedValueOnce(3) // home access
      .mockResolvedValueOnce(2) // created in range
      .mockResolvedValueOnce(1) // created previous
      .mockResolvedValueOnce(1) // identity approved in range
      .mockResolvedValueOnce(0); // identity approved previous
    db.activity.groupBy.mockResolvedValue([
      { status: "PUBLISHED", _count: { _all: 20 } },
      { status: "DRAFT", _count: { _all: 16 } },
    ]);
    db.activity.count.mockResolvedValue(4);
    vi.spyOn(IdentityAdminReviewService.prototype, "getReviewSummary").mockResolvedValue({
      scope: "GLOBAL_STATUS_TOTALS",
      pending: 3,
      pendingActionable: 2,
      pendingOnHold: 1,
      pendingTotal: 3,
      approved: 3,
      rejected: 1,
    });

    const service = new AdminDashboardService(db as never, env);
    const overview = await service.getOverview("last_30_days");

    expect(overview.kpis.totalUsers.value).toBe(12);
    expect(overview.kpis.totalUsers.secondary.value).toBe(2);
    expect(overview.kpis.activeAccounts.label).toBe("Active Accounts");
    expect(overview.kpis.activeAccounts.definition).toContain("not DAU");
    expect(overview.kpis.verified.secondary.value).toBe(3);
    expect(overview.kpis.premium.available).toBe(false);
    expect(overview.kpis.premium.trackerId).toBe("BE-061");
    expect(overview.kpis.revenue.available).toBe(false);
    expect(overview.kpis.activities.value).toBe(36);
    expect(overview.kpis.pendingModeration.value).toBe(2);
    expect(overview.kpis.pendingModeration.warning).toBe(true);
    expect(overview.realtimePush).toBe(false);
    expect(JSON.stringify(overview)).not.toContain("48290");
    expect(JSON.stringify(overview)).not.toContain("124550");
  });

  it("builds cumulative signup points and labels retention unavailable", async () => {
    const db = createDb();
    db.user.findFirst.mockResolvedValue({ createdAt: new Date("2026-10-01T00:00:00.000Z") });
    db.user.count.mockResolvedValue(10);
    db.user.findMany.mockResolvedValue([
      { createdAt: new Date("2026-10-31T01:00:00.000Z") },
      { createdAt: new Date("2026-10-31T02:00:00.000Z") },
    ]);
    const service = new AdminDashboardService(db as never, env);
    const growth = await service.getGrowth("last_30_days");
    expect(growth.series.signups.available).toBe(true);
    expect(growth.series.signups.kind).toBe("PERIOD_COUNT");
    expect(growth.series.signups.totalInRange).toBe(2);
    expect(growth.series.activeUsers.available).toBe(false);
    expect(growth.series.signups.points.at(-1)?.cumulativeCount).toBe(12);
  });

  it("ranks real catalog categories by activity share", async () => {
    const db = createDb();
    db.user.findFirst.mockResolvedValue(null);
    db.activityCategory.findMany.mockResolvedValue([
      { id: "c1", slug: "running", label: "Running", sortOrder: 1 },
      { id: "c2", slug: "biking", label: "Biking", sortOrder: 2 },
      { id: "c3", slug: "fitness", label: "Fitness", sortOrder: 3 },
    ]);
    db.activity.groupBy.mockResolvedValue([
      { categoryId: "c1", _count: { _all: 20 } },
      { categoryId: "c2", _count: { _all: 10 } },
      { categoryId: "c3", _count: { _all: 6 } },
    ]);
    db.activityParticipation.count
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2);
    const service = new AdminDashboardService(db as never, env);
    const result = await service.getActivityCategories("all_time", 2);
    expect(result.denominator).toBe("ACTIVITY_SHARE");
    expect(result.categories).toHaveLength(2);
    expect(result.categories[0]?.slug).toBe("running");
    expect(result.categories[0]?.sharePercent).toBe(55.6);
    expect(result.hasMore).toBe(true);
    expect(result.categories.map((c) => c.label).join(",")).not.toContain("Coffee");
  });

  it("returns unsupported recent-event feeds instead of invented rows", async () => {
    const service = new AdminDashboardService(createDb() as never, env);
    const groups = await service.getRecentEvents({ category: "groups", limit: 20 });
    expect(groups.available).toBe(false);
    expect(groups.trackerId).toBe("BE-064");
    expect(groups.events).toEqual([]);
  });

  it("merges durable audit rows newest first", async () => {
    const db = createDb();
    db.identityAdminReviewDecision.findMany.mockResolvedValue([
      {
        id: "id-1",
        userId: "user-1",
        status: "APPROVED",
        createdAt: new Date("2026-10-31T12:00:00.000Z"),
        user: {
          profile: { displayName: "Ada", firstName: null, lastName: null, avatarStorageKey: null },
        },
      },
    ]);
    db.accountModerationDecision.findMany.mockResolvedValue([
      {
        id: "acc-1",
        userId: "user-2",
        action: "SUSPEND",
        resultingAccountStatus: "SUSPENDED",
        createdAt: new Date("2026-10-31T13:00:00.000Z"),
        user: {
          profile: { displayName: "Ben", firstName: null, lastName: null, avatarStorageKey: "k" },
        },
      },
    ]);
    db.activityModerationDecision.findMany.mockResolvedValue([]);
    const service = new AdminDashboardService(db as never, env);
    const result = await service.getRecentEvents({ category: "all", limit: 20 });
    expect(result.available).toBe(true);
    expect(result.events[0]?.source).toBe("ACCOUNT_MODERATION");
    expect(result.events[1]?.source).toBe("IDENTITY_REVIEW");
    expect(result.events[0]?.action?.href).toBe("/users/user-2");
  });
});
