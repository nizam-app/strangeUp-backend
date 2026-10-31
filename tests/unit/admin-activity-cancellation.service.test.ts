import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/common/errors/app-error.js";
import type { DatabaseClient } from "../../src/infrastructure/database/prisma.js";
import { AdminActivityCancellationService } from "../../src/modules/admin/admin-activity-cancellation.service.js";
import type { User } from "../../generated/prisma/client.js";

const actorId = "11111111-1111-4111-8111-111111111111";
const hostId = "22222222-2222-4222-8222-222222222222";
const activityId = "33333333-3333-4333-8333-333333333333";
const now = new Date("2026-10-31T12:00:00.000Z");

function actor(id = actorId): User {
  return { id } as User;
}

type Harness = {
  service: AdminActivityCancellationService;
  state: {
    activity: {
      id: string;
      hostId: string;
      status: string;
      cancelledAt: Date | null;
      updatedAt: Date;
    } | null;
    actorGrant: { revokedAt: Date | null } | null;
    participationCounts: Array<{ state: string; _count: { _all: number } }>;
    updateCount: number;
    participationUpdates: number;
    findCount: number;
    decisions: Array<Record<string, unknown>>;
    concurrentUpdate?: boolean;
    missingAuditTable?: boolean;
  };
};

function createHarness(): Harness {
  const state: Harness["state"] = {
    activity: {
      id: activityId,
      hostId,
      status: "PUBLISHED",
      cancelledAt: null,
      updatedAt: now,
    },
    actorGrant: { revokedAt: null },
    participationCounts: [
      { state: "CONFIRMED", _count: { _all: 2 } },
      { state: "WAITLISTED", _count: { _all: 1 } },
      { state: "PENDING", _count: { _all: 1 } },
    ],
    updateCount: 0,
    participationUpdates: 0,
    findCount: 0,
    decisions: [],
  };

  const findActivity = vi.fn(({ where }: { where: { id: string } }) => {
    if (!state.activity || where.id !== state.activity.id) {
      return Promise.resolve(null);
    }
    state.findCount += 1;
    if (state.concurrentUpdate && state.findCount > 1) {
      return Promise.resolve({
        ...state.activity,
        status: "CANCELLED",
        cancelledAt: now,
        updatedAt: new Date(now.getTime() + 50),
      });
    }
    return Promise.resolve(state.activity);
  });

  const findDecision = vi.fn(({ where }: { where: { idempotencyKey?: string } }) => {
    if (state.missingAuditTable) {
      return Promise.reject(Object.assign(new Error("table missing"), { code: "P2021" }));
    }
    if (where.idempotencyKey) {
      return Promise.resolve(
        state.decisions.find((row) => row.idempotencyKey === where.idempotencyKey) ?? null,
      );
    }
    return Promise.resolve(null);
  });

  const tx = {
    $executeRaw: vi.fn(() => Promise.resolve(1)),
    platformStaffGrant: {
      findUnique: vi.fn(
        ({ where }: { where: { userId_role: { userId: string; role: string } } }) => {
          if (where.userId_role.userId === actorId && where.userId_role.role === "SUPER_ADMIN") {
            return Promise.resolve(state.actorGrant);
          }
          return Promise.resolve(null);
        },
      ),
    },
    activity: {
      findUnique: findActivity,
      update: vi.fn(() => {
        if (state.activity) {
          state.updateCount += 1;
          state.activity = {
            ...state.activity,
            status: "CANCELLED",
            cancelledAt: now,
            updatedAt: new Date(now.getTime() + 1000),
          };
        }
        return Promise.resolve(state.activity);
      }),
    },
    activityParticipation: {
      groupBy: vi.fn(() => Promise.resolve(state.participationCounts)),
      updateMany: vi.fn(() => {
        state.participationUpdates += 1;
        return Promise.resolve({ count: 4 });
      }),
    },
    activityModerationDecision: {
      findUnique: findDecision,
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        if (state.missingAuditTable) {
          return Promise.reject(Object.assign(new Error("table missing"), { code: "P2021" }));
        }
        const row = {
          id: `decision-${state.decisions.length + 1}`,
          createdAt: now,
          ...data,
        };
        state.decisions.push(row);
        return Promise.resolve(row);
      }),
    },
  };

  const db = {
    ...tx,
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    activityModerationDecision: {
      findUnique: findDecision,
      create: tx.activityModerationDecision.create,
    },
    activity: {
      findUnique: findActivity,
      update: tx.activity.update,
    },
  } as unknown as DatabaseClient;

  return {
    service: new AdminActivityCancellationService(db),
    state,
  };
}

describe("AdminActivityCancellationService", () => {
  it("cancels a published activity, writes audit, and preserves participation rows", async () => {
    const { service, state } = createHarness();
    const result = await service.cancelActivity({
      actor: actor(),
      activityId,
      reasonCode: "SAFETY",
      reason: "Listing violates community safety rules.",
      idempotencyKey: "cancel-key-01",
    });

    expect(result.status).toBe("CANCELLED");
    expect(result.notificationsSent).toBe(false);
    expect(result.refundsIssued).toBe(false);
    expect(result.participantRecordsDeleted).toBe(false);
    expect(result.confirmedClosedCount).toBe(2);
    expect(result.waitlistedClosedCount).toBe(1);
    expect(result.pendingClosedCount).toBe(1);
    expect(state.updateCount).toBe(1);
    expect(state.participationUpdates).toBe(1);
    expect(state.decisions).toHaveLength(1);
    expect(state.decisions[0]).toMatchObject({
      action: "CANCEL",
      actorUserId: actorId,
      activityId,
      previousActivityStatus: "PUBLISHED",
      resultingActivityStatus: "CANCELLED",
    });
  });

  it("replays the same idempotency key without a second write", async () => {
    const { service, state } = createHarness();
    await service.cancelActivity({
      actor: actor(),
      activityId,
      reasonCode: "SAFETY",
      reason: "Listing violates community safety rules.",
      idempotencyKey: "cancel-key-01",
    });
    const replay = await service.cancelActivity({
      actor: actor(),
      activityId,
      reasonCode: "SAFETY",
      reason: "Listing violates community safety rules.",
      idempotencyKey: "cancel-key-01",
    });
    expect(replay.idempotentReplay).toBe(true);
    expect(state.updateCount).toBe(1);
    expect(state.decisions).toHaveLength(1);

    state.decisions[0] = { ...state.decisions[0], reason: "Different stored reason." };
    await expect(
      service.cancelActivity({
        actor: actor(),
        activityId,
        reasonCode: "SAFETY",
        reason: "Listing violates community safety rules.",
        idempotencyKey: "cancel-key-01",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Idempotency key reused with different payload",
    });
  });

  it("rejects a later cancel after the activity is already cancelled", async () => {
    const { service, state } = createHarness();
    await service.cancelActivity({
      actor: actor(),
      activityId,
      reasonCode: "SAFETY",
      reason: "Listing violates community safety rules.",
      idempotencyKey: "cancel-key-01",
    });
    state.activity = {
      id: activityId,
      hostId,
      status: "CANCELLED",
      cancelledAt: now,
      updatedAt: new Date(now.getTime() + 1000),
    };
    await expect(
      service.cancelActivity({
        actor: actor(),
        activityId,
        reasonCode: "ABUSE",
        reason: "A second documented cancellation attempt.",
        idempotencyKey: "cancel-key-other",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
  });

  it("returns 403 for reviewer-only and host-own-activity actors", async () => {
    const reviewer = createHarness();
    reviewer.state.actorGrant = null;
    await expect(
      reviewer.service.cancelActivity({
        actor: actor(),
        activityId,
        reasonCode: "ABUSE",
        reason: "Harassment reports from multiple members.",
      }),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN", statusCode: 403 });

    const hostActor = createHarness();
    hostActor.state.activity = {
      id: activityId,
      hostId: actorId,
      status: "PUBLISHED",
      cancelledAt: null,
      updatedAt: now,
    };
    await expect(
      hostActor.service.cancelActivity({
        actor: actor(),
        activityId,
        reasonCode: "ABUSE",
        reason: "Harassment reports from multiple members.",
      }),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN", statusCode: 403 });
  });

  it("returns 409 for cancelled, completed, and concurrent updates", async () => {
    const cancelled = createHarness();
    cancelled.state.activity = {
      id: activityId,
      hostId,
      status: "CANCELLED",
      cancelledAt: now,
      updatedAt: now,
    };
    await expect(
      cancelled.service.cancelActivity({
        actor: actor(),
        activityId,
        reasonCode: "OTHER",
        reason: "Documented owner request to cancel.",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });

    const completed = createHarness();
    completed.state.activity = {
      id: activityId,
      hostId,
      status: "COMPLETED",
      cancelledAt: null,
      updatedAt: now,
    };
    await expect(
      completed.service.cancelActivity({
        actor: actor(),
        activityId,
        reasonCode: "OTHER",
        reason: "Documented owner request to cancel.",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });

    const concurrent = createHarness();
    concurrent.state.concurrentUpdate = true;
    await expect(
      concurrent.service.cancelActivity({
        actor: actor(),
        activityId,
        reasonCode: "FRAUD",
        reason: "Chargeback and fake identity reports.",
        expectedStatus: "PUBLISHED",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
  });

  it("fail-closes when the audit table is missing", async () => {
    const { service, state } = createHarness();
    state.missingAuditTable = true;
    await expect(
      service.cancelActivity({
        actor: actor(),
        activityId,
        reasonCode: "SAFETY",
        reason: "Listing violates community safety rules.",
        idempotencyKey: "cancel-key-02",
      }),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", statusCode: 503 });
    expect(state.decisions).toHaveLength(0);
  });

  it("returns 404 for missing activities", async () => {
    const { service, state } = createHarness();
    state.activity = null;
    await expect(
      service.cancelActivity({
        actor: actor(),
        activityId,
        reasonCode: "OTHER",
        reason: "Documented owner request to cancel.",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
