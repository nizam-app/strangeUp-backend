import { describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/common/errors/app-error.js";
import type { DatabaseClient } from "../../src/infrastructure/database/prisma.js";
import { AdminAccountModerationService } from "../../src/modules/admin/admin-account-moderation.service.js";
import type { User } from "../../generated/prisma/client.js";

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const staffId = "33333333-3333-4333-8333-333333333333";
const now = new Date("2026-10-31T12:00:00.000Z");

function actor(id = actorId): User {
  return { id } as User;
}

type Harness = {
  service: AdminAccountModerationService;
  restrictionSideEffects: ReturnType<typeof vi.fn>;
  state: {
    user: {
      id: string;
      accountStatus: string;
      suspendedAt: Date | null;
      deletedAt: Date | null;
      updatedAt: Date;
    } | null;
    actorGrant: { revokedAt: Date | null } | null;
    targetStaffGrant: { id: string } | null;
    updateCount: number;
    sessionsRevoked: number;
    deviceTokensRevoked: number;
    decisions: Array<Record<string, unknown>>;
    throwOnSessionRevoke?: boolean;
    concurrentUpdate?: boolean;
  };
};

function createHarness(): Harness {
  const restrictionSideEffects = vi.fn().mockResolvedValue(undefined);
  const state: Harness["state"] = {
    user: {
      id: targetId,
      accountStatus: "ACTIVE",
      suspendedAt: null,
      deletedAt: null,
      updatedAt: now,
    },
    actorGrant: { revokedAt: null },
    targetStaffGrant: null,
    updateCount: 0,
    sessionsRevoked: 0,
    deviceTokensRevoked: 0,
    decisions: [],
  };

  const tx = {
    platformStaffGrant: {
      findUnique: vi.fn(
        ({ where }: { where: { userId_role: { userId: string; role: string } } }) => {
          if (where.userId_role.userId === actorId && where.userId_role.role === "SUPER_ADMIN") {
            return Promise.resolve(state.actorGrant);
          }
          return Promise.resolve(null);
        },
      ),
      findFirst: vi.fn(({ where }: { where: { userId: string } }) => {
        if (where.userId === targetId) {
          return Promise.resolve(state.targetStaffGrant);
        }
        return Promise.resolve(null);
      }),
    },
    user: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        if (!state.user || where.id !== state.user.id) {
          return Promise.resolve(null);
        }
        return Promise.resolve(state.user);
      }),
      updateMany: vi.fn(() => {
        if (state.concurrentUpdate) {
          return Promise.resolve({ count: 0 });
        }
        state.updateCount += 1;
        if (state.user && state.user.accountStatus !== "SUSPENDED") {
          state.user = {
            ...state.user,
            accountStatus: "SUSPENDED",
            suspendedAt: now,
            updatedAt: new Date(now.getTime() + 1000),
          };
        } else if (state.user) {
          state.user = {
            ...state.user,
            accountStatus: "ACTIVE",
            suspendedAt: null,
            updatedAt: new Date(now.getTime() + 1000),
          };
        }
        return Promise.resolve({ count: 1 });
      }),
    },
    session: {
      updateMany: vi.fn(() => {
        if (state.throwOnSessionRevoke) {
          return Promise.reject(new Error("session store unavailable"));
        }
        state.sessionsRevoked += 1;
        return Promise.resolve({ count: 2 });
      }),
    },
    userDeviceToken: {
      updateMany: vi.fn(() => {
        state.deviceTokensRevoked += 1;
        return Promise.resolve({ count: 1 });
      }),
    },
    accountModerationDecision: {
      findFirst: vi.fn(({ where }: { where: { userId: string; action: string } }) => {
        return Promise.resolve(
          [...state.decisions]
            .reverse()
            .find((row) => row.userId === where.userId && row.action === where.action) ?? null,
        );
      }),
      findUnique: vi.fn(() => Promise.resolve(null)),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
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
    accountModerationDecision: {
      ...tx.accountModerationDecision,
    },
    user: {
      ...tx.user,
    },
  } as unknown as DatabaseClient;

  return {
    service: new AdminAccountModerationService(db, restrictionSideEffects),
    restrictionSideEffects,
    state,
  };
}

describe("AdminAccountModerationService", () => {
  it("suspends an active user, writes audit, and revokes sessions", async () => {
    const { service, state, restrictionSideEffects } = createHarness();
    const result = await service.suspendAccount({
      actor: actor(),
      userId: targetId,
      reasonCode: "POLICY_VIOLATION",
      reason: "Repeated community guideline violations.",
      idempotencyKey: "suspend-key-01",
    });

    expect(result.accountStatus).toBe("SUSPENDED");
    expect(result.sessionsRevoked).toBe(true);
    expect(result.idempotentReplay).toBe(false);
    expect(state.updateCount).toBe(1);
    expect(state.sessionsRevoked).toBe(1);
    expect(state.deviceTokensRevoked).toBe(1);
    expect(restrictionSideEffects).toHaveBeenCalledTimes(1);
    expect(restrictionSideEffects).toHaveBeenCalledWith(targetId);
    expect(state.decisions).toHaveLength(1);
    expect(state.decisions[0]).toMatchObject({
      action: "SUSPEND",
      actorUserId: actorId,
      userId: targetId,
      reasonCode: "POLICY_VIOLATION",
      previousAccountStatus: "ACTIVE",
      resultingAccountStatus: "SUSPENDED",
    });
  });

  it("is idempotent when the account is already suspended", async () => {
    const { service, state } = createHarness();
    state.user = {
      id: targetId,
      accountStatus: "SUSPENDED",
      suspendedAt: now,
      deletedAt: null,
      updatedAt: now,
    };
    state.decisions.push({
      id: "existing",
      userId: targetId,
      actorUserId: actorId,
      action: "SUSPEND",
      reasonCode: "POLICY_VIOLATION",
      reason: "Already recorded.",
      previousAccountStatus: "ACTIVE",
      resultingAccountStatus: "SUSPENDED",
      createdAt: now,
    });

    const result = await service.suspendAccount({
      actor: actor(),
      userId: targetId,
      reasonCode: "POLICY_VIOLATION",
      reason: "Repeated community guideline violations.",
    });
    expect(result.idempotentReplay).toBe(true);
    expect(state.updateCount).toBe(0);
  });

  it("restores prior status without touching identity fields", async () => {
    const { service, state, restrictionSideEffects } = createHarness();
    state.user = {
      id: targetId,
      accountStatus: "SUSPENDED",
      suspendedAt: now,
      deletedAt: null,
      updatedAt: now,
    };
    state.decisions.push({
      id: "prior",
      userId: targetId,
      actorUserId: actorId,
      action: "SUSPEND",
      reasonCode: "SAFETY",
      reason: "Safety hold.",
      previousAccountStatus: "PENDING_VERIFICATION",
      resultingAccountStatus: "SUSPENDED",
      createdAt: now,
    });

    const result = await service.restoreAccount({
      actor: actor(),
      userId: targetId,
      idempotencyKey: "restore-key-01",
    });
    expect(result.resultingAccountStatus).toBe("PENDING_VERIFICATION");
    expect(result.suspendedAt).toBeNull();
    expect(state.decisions.at(-1)).toMatchObject({
      action: "RESTORE",
      previousAccountStatus: "SUSPENDED",
      resultingAccountStatus: "PENDING_VERIFICATION",
    });
    expect(restrictionSideEffects).not.toHaveBeenCalled();
  });

  it("returns 403 for reviewer-only, self, and staff targets", async () => {
    const { service, state } = createHarness();
    state.actorGrant = null;
    await expect(
      service.suspendAccount({
        actor: actor(),
        userId: targetId,
        reasonCode: "ABUSE",
        reason: "Harassment reports from multiple members.",
      }),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN", statusCode: 403 });

    const selfHarness = createHarness();
    selfHarness.state.user = {
      id: actorId,
      accountStatus: "ACTIVE",
      suspendedAt: null,
      deletedAt: null,
      updatedAt: now,
    };
    await expect(
      selfHarness.service.suspendAccount({
        actor: actor(),
        userId: actorId,
        reasonCode: "ABUSE",
        reason: "Harassment reports from multiple members.",
      }),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN", statusCode: 403 });

    const staffHarness = createHarness();
    staffHarness.state.user = {
      id: targetId,
      accountStatus: "ACTIVE",
      suspendedAt: null,
      deletedAt: null,
      updatedAt: now,
    };
    staffHarness.state.targetStaffGrant = { id: staffId };
    await expect(
      staffHarness.service.suspendAccount({
        actor: actor(),
        userId: targetId,
        reasonCode: "ABUSE",
        reason: "Harassment reports from multiple members.",
      }),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN", statusCode: 403 });
  });

  it("returns 409 on concurrent conflicting updates", async () => {
    const { service, state } = createHarness();
    state.concurrentUpdate = true;
    await expect(
      service.suspendAccount({
        actor: actor(),
        userId: targetId,
        reasonCode: "FRAUD",
        reason: "Chargeback and fake identity reports.",
        expectedAccountStatus: "ACTIVE",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", statusCode: 409 });
  });

  it("fails closed when session invalidation cannot be guaranteed", async () => {
    const { service, state, restrictionSideEffects } = createHarness();
    state.throwOnSessionRevoke = true;
    await expect(
      service.suspendAccount({
        actor: actor(),
        userId: targetId,
        reasonCode: "SAFETY",
        reason: "Credible safety threat reported by staff.",
      }),
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", statusCode: 503 });
    expect(state.decisions).toHaveLength(0);
    expect(restrictionSideEffects).not.toHaveBeenCalled();
  });

  it("does not fail the committed suspend when socket side effects reject", async () => {
    const { service, restrictionSideEffects } = createHarness();
    restrictionSideEffects.mockRejectedValueOnce(new Error("socket bus unavailable"));
    const result = await service.suspendAccount({
      actor: actor(),
      userId: targetId,
      reasonCode: "SAFETY",
      reason: "Credible safety threat reported by staff.",
    });
    expect(result.accountStatus).toBe("SUSPENDED");
    expect(result.decisionId).toBe("decision-1");
    expect(restrictionSideEffects).toHaveBeenCalledWith(targetId);
  });

  it("returns 404 for missing users", async () => {
    const { service, state } = createHarness();
    state.user = null;
    await expect(
      service.suspendAccount({
        actor: actor(),
        userId: targetId,
        reasonCode: "OTHER",
        reason: "Documented owner request to suspend.",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
