import { createHash } from "node:crypto";
import pino from "pino";
import type { AccountStatus, User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { applyAccountRestrictionSideEffects } from "../account/account-restriction.side-effects.js";
import { ADMIN_ACCOUNT_RESTORE_REASON_CODE } from "./admin-account-moderation-reason-codes.js";
import {
  isSuspendableAccountStatus,
  resolveAccountModerationCapabilities,
  restoreAccountStatusFromPrior,
} from "./admin-account-moderation.policy.js";
import { adminAccountModerationIdempotencyKeySchema } from "./admin-account-moderation.validation.js";
import { userIsActiveSuperAdmin } from "./platform-staff-policy.js";

const restrictionSideEffectLog = pino({ name: "admin-account-moderation" });

export type AccountRestrictionSideEffects = (userId: string) => Promise<void>;

export type AccountModerationDecisionDto = {
  userId: string;
  action: "SUSPEND" | "RESTORE";
  accountStatus: AccountStatus;
  suspendedAt: string | null;
  previousAccountStatus: AccountStatus;
  resultingAccountStatus: AccountStatus;
  reasonCode: string;
  reason: string;
  actorUserId: string;
  decisionId: string;
  createdAt: string;
  idempotentReplay: boolean;
  sessionsRevoked: boolean;
};

type ModerationTargetRow = {
  id: string;
  accountStatus: AccountStatus;
  suspendedAt: Date | null;
  deletedAt: Date | null;
  updatedAt: Date;
};

type TransactionClient = Parameters<Parameters<DatabaseClient["$transaction"]>[0]>[0];

const SESSION_INVALIDATION_FAILED = "Session invalidation could not be guaranteed";

function scopedIdempotencyKey(input: {
  actorUserId: string;
  userId: string;
  action: "SUSPEND" | "RESTORE";
  headerKey: string;
  reasonCode: string;
  reason: string;
}): string {
  const digest = createHash("sha256")
    .update(
      [
        "account-moderation",
        input.action,
        input.actorUserId,
        input.userId,
        input.headerKey,
        input.reasonCode,
        input.reason,
      ].join(":"),
      "utf8",
    )
    .digest("hex");
  return `account-moderation:${digest}`;
}

function mapDecision(row: {
  id: string;
  userId: string;
  actorUserId: string;
  action: "SUSPEND" | "RESTORE";
  reasonCode: string;
  reason: string;
  previousAccountStatus: AccountStatus;
  resultingAccountStatus: AccountStatus;
  createdAt: Date;
  suspendedAt: Date | null;
  idempotentReplay: boolean;
  sessionsRevoked: boolean;
}): AccountModerationDecisionDto {
  return {
    userId: row.userId,
    action: row.action,
    accountStatus: row.resultingAccountStatus,
    suspendedAt: row.suspendedAt?.toISOString() ?? null,
    previousAccountStatus: row.previousAccountStatus,
    resultingAccountStatus: row.resultingAccountStatus,
    reasonCode: row.reasonCode,
    reason: row.reason,
    actorUserId: row.actorUserId,
    decisionId: row.id,
    createdAt: row.createdAt.toISOString(),
    idempotentReplay: row.idempotentReplay,
    sessionsRevoked: row.sessionsRevoked,
  };
}

function isPrismaUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function isPrismaSerializationFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2034"
  );
}

export class AdminAccountModerationService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly restrictionSideEffects: AccountRestrictionSideEffects = applyAccountRestrictionSideEffects,
  ) {}

  async suspendAccount(input: {
    actor: User;
    userId: string;
    reasonCode: string;
    reason: string;
    expectedAccountStatus?: AccountStatus;
    idempotencyKey?: string;
  }): Promise<AccountModerationDecisionDto> {
    return this.moderate({
      actor: input.actor,
      userId: input.userId,
      action: "SUSPEND",
      reasonCode: input.reasonCode,
      reason: input.reason,
      expectedAccountStatus: input.expectedAccountStatus,
      idempotencyKey: input.idempotencyKey,
    });
  }

  async restoreAccount(input: {
    actor: User;
    userId: string;
    reason?: string;
    expectedAccountStatus?: AccountStatus;
    idempotencyKey?: string;
  }): Promise<AccountModerationDecisionDto> {
    return this.moderate({
      actor: input.actor,
      userId: input.userId,
      action: "RESTORE",
      reasonCode: ADMIN_ACCOUNT_RESTORE_REASON_CODE,
      reason: input.reason?.trim() || "Account restored by administrator.",
      expectedAccountStatus: input.expectedAccountStatus,
      idempotencyKey: input.idempotencyKey,
    });
  }

  private async moderate(input: {
    actor: User;
    userId: string;
    action: "SUSPEND" | "RESTORE";
    reasonCode: string;
    reason: string;
    expectedAccountStatus?: AccountStatus;
    idempotencyKey?: string;
  }): Promise<AccountModerationDecisionDto> {
    const headerKey = input.idempotencyKey
      ? adminAccountModerationIdempotencyKeySchema.parse(input.idempotencyKey)
      : undefined;
    const scopedKey = headerKey
      ? scopedIdempotencyKey({
          actorUserId: input.actor.id,
          userId: input.userId,
          action: input.action,
          headerKey,
          reasonCode: input.reasonCode,
          reason: input.reason,
        })
      : null;

    if (scopedKey) {
      const replay = await this.findIdempotentReplay(scopedKey, input);
      if (replay) {
        await this.applyPostCommitRestrictionEffects(input.action, input.userId);
        return replay;
      }
    }

    try {
      const result = await this.db.$transaction(async (tx) => {
        await this.assertActorIsSuperAdmin(tx, input.actor.id);

        const target = await tx.user.findUnique({
          where: { id: input.userId },
          select: {
            id: true,
            accountStatus: true,
            suspendedAt: true,
            deletedAt: true,
            updatedAt: true,
          },
        });
        if (!target || target.deletedAt || target.accountStatus === "DELETED") {
          throw new AppError("NOT_FOUND", "User not found", 404);
        }

        const targetHasActiveStaffGrant = await this.targetHasActiveStaffGrant(tx, target.id);
        const capabilities = resolveAccountModerationCapabilities({
          actorUserId: input.actor.id,
          actorIsSuperAdmin: true,
          target: {
            userId: target.id,
            accountStatus: target.accountStatus,
            deletedAt: target.deletedAt,
          },
          targetHasActiveStaffGrant,
        });
        this.assertCapability(input.action, capabilities);

        if (input.expectedAccountStatus && input.expectedAccountStatus !== target.accountStatus) {
          throw new AppError(
            "CONFLICT",
            "Account status changed. Reload the user and try again.",
            409,
          );
        }

        if (input.action === "SUSPEND") {
          return this.executeSuspend(tx, {
            actor: input.actor,
            target,
            reasonCode: input.reasonCode,
            reason: input.reason,
            scopedKey,
          });
        }
        return this.executeRestore(tx, {
          actor: input.actor,
          target,
          reasonCode: input.reasonCode,
          reason: input.reason,
          scopedKey,
        });
      });

      await this.applyPostCommitRestrictionEffects(input.action, input.userId);
      return result;
    } catch (error) {
      if (isPrismaUniqueConflict(error) && scopedKey) {
        const replay = await this.findIdempotentReplay(scopedKey, input);
        if (replay) {
          await this.applyPostCommitRestrictionEffects(input.action, input.userId);
          return replay;
        }
        throw new AppError("CONFLICT", "Idempotency key reused with different payload", 409);
      }
      if (isPrismaSerializationFailure(error)) {
        throw new AppError(
          "CONFLICT",
          "Account status changed. Reload the user and try again.",
          409,
        );
      }
      throw error;
    }
  }

  private async executeSuspend(
    tx: TransactionClient,
    input: {
      actor: User;
      target: ModerationTargetRow;
      reasonCode: string;
      reason: string;
      scopedKey: string | null;
    },
  ): Promise<AccountModerationDecisionDto> {
    if (input.target.accountStatus === "SUSPENDED") {
      const existing = await this.latestDecision(tx, input.target.id, "SUSPEND");
      if (existing) {
        return mapDecision({
          ...existing,
          suspendedAt: input.target.suspendedAt,
          idempotentReplay: true,
          sessionsRevoked: true,
        });
      }
    }
    if (!isSuspendableAccountStatus(input.target.accountStatus)) {
      throw new AppError("CONFLICT", "Account cannot be suspended from the current status", 409);
    }

    const now = new Date();
    const updated = await tx.user.updateMany({
      where: {
        id: input.target.id,
        accountStatus: input.target.accountStatus,
        updatedAt: input.target.updatedAt,
        deletedAt: null,
      },
      data: {
        accountStatus: "SUSPENDED",
        suspendedAt: now,
      },
    });
    if (updated.count !== 1) {
      throw new AppError("CONFLICT", "Account status changed. Reload the user and try again.", 409);
    }

    await this.revokeAuthenticatedAccess(tx, input.target.id, now);

    const decision = await tx.accountModerationDecision.create({
      data: {
        userId: input.target.id,
        actorUserId: input.actor.id,
        action: "SUSPEND",
        reasonCode: input.reasonCode,
        reason: input.reason,
        previousAccountStatus: input.target.accountStatus,
        resultingAccountStatus: "SUSPENDED",
        idempotencyKey: input.scopedKey,
      },
    });

    return mapDecision({
      ...decision,
      suspendedAt: now,
      idempotentReplay: false,
      sessionsRevoked: true,
    });
  }

  private async executeRestore(
    tx: TransactionClient,
    input: {
      actor: User;
      target: ModerationTargetRow;
      reasonCode: string;
      reason: string;
      scopedKey: string | null;
    },
  ): Promise<AccountModerationDecisionDto> {
    if (input.target.accountStatus !== "SUSPENDED") {
      const existing = await this.latestDecision(tx, input.target.id, "RESTORE");
      if (existing) {
        return mapDecision({
          ...existing,
          suspendedAt: null,
          idempotentReplay: true,
          sessionsRevoked: true,
        });
      }
      return {
        userId: input.target.id,
        action: "RESTORE",
        accountStatus: input.target.accountStatus,
        suspendedAt: null,
        previousAccountStatus: input.target.accountStatus,
        resultingAccountStatus: input.target.accountStatus,
        reasonCode: input.reasonCode,
        reason: input.reason,
        actorUserId: input.actor.id,
        decisionId: "idempotent-restore",
        createdAt: new Date().toISOString(),
        idempotentReplay: true,
        sessionsRevoked: true,
      };
    }

    const priorSuspend = await this.latestDecision(tx, input.target.id, "SUSPEND");
    const restoredStatus = restoreAccountStatusFromPrior(
      priorSuspend?.previousAccountStatus ?? null,
    );

    const updated = await tx.user.updateMany({
      where: {
        id: input.target.id,
        accountStatus: "SUSPENDED",
        updatedAt: input.target.updatedAt,
        deletedAt: null,
      },
      data: {
        accountStatus: restoredStatus,
        suspendedAt: null,
      },
    });
    if (updated.count !== 1) {
      throw new AppError("CONFLICT", "Account status changed. Reload the user and try again.", 409);
    }

    const decision = await tx.accountModerationDecision.create({
      data: {
        userId: input.target.id,
        actorUserId: input.actor.id,
        action: "RESTORE",
        reasonCode: input.reasonCode,
        reason: input.reason,
        previousAccountStatus: "SUSPENDED",
        resultingAccountStatus: restoredStatus,
        idempotencyKey: input.scopedKey,
      },
    });

    return mapDecision({
      ...decision,
      suspendedAt: null,
      idempotentReplay: false,
      sessionsRevoked: true,
    });
  }

  private async revokeAuthenticatedAccess(
    tx: TransactionClient,
    userId: string,
    now: Date,
  ): Promise<void> {
    try {
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.userDeviceToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
    } catch (error) {
      throw new AppError("SERVICE_UNAVAILABLE", SESSION_INVALIDATION_FAILED, 503, {
        cause: error,
      });
    }
  }

  private async assertActorIsSuperAdmin(
    db: Pick<DatabaseClient, "platformStaffGrant"> | TransactionClient,
    actorUserId: string,
  ): Promise<void> {
    const allowed = await userIsActiveSuperAdmin(db as DatabaseClient, actorUserId);
    if (!allowed) {
      throw new AppError("AUTH_FORBIDDEN", "Super administrator access required", 403);
    }
  }

  private async targetHasActiveStaffGrant(db: TransactionClient, userId: string): Promise<boolean> {
    const grant = await db.platformStaffGrant.findFirst({
      where: { userId, revokedAt: null },
      select: { id: true },
    });
    return grant !== null;
  }

  private assertCapability(
    action: "SUSPEND" | "RESTORE",
    capabilities: ReturnType<typeof resolveAccountModerationCapabilities>,
  ): void {
    if (action === "SUSPEND" && !capabilities.canSuspend) {
      if (capabilities.blockedReason === "SELF") {
        throw new AppError("AUTH_FORBIDDEN", "You cannot suspend your own account", 403);
      }
      if (capabilities.blockedReason === "STAFF_ACCOUNT") {
        throw new AppError("AUTH_FORBIDDEN", "Staff accounts cannot be suspended here", 403);
      }
      if (capabilities.blockedReason === "NOT_SUPER_ADMIN") {
        throw new AppError("AUTH_FORBIDDEN", "Super administrator access required", 403);
      }
      if (capabilities.blockedReason === "ALREADY_SUSPENDED") {
        return;
      }
      throw new AppError("AUTH_FORBIDDEN", "Account cannot be suspended", 403);
    }
    if (action === "RESTORE" && !capabilities.canRestore) {
      if (capabilities.blockedReason === "SELF") {
        throw new AppError("AUTH_FORBIDDEN", "You cannot restore your own account", 403);
      }
      if (capabilities.blockedReason === "STAFF_ACCOUNT") {
        throw new AppError("AUTH_FORBIDDEN", "Staff accounts cannot be restored here", 403);
      }
      if (capabilities.blockedReason === "NOT_SUPER_ADMIN") {
        throw new AppError("AUTH_FORBIDDEN", "Super administrator access required", 403);
      }
      if (capabilities.blockedReason === "NOT_SUSPENDED") {
        return;
      }
      throw new AppError("AUTH_FORBIDDEN", "Account cannot be restored", 403);
    }
  }

  private async latestDecision(
    db: TransactionClient,
    userId: string,
    action: "SUSPEND" | "RESTORE",
  ) {
    return db.accountModerationDecision.findFirst({
      where: { userId, action },
      orderBy: { createdAt: "desc" },
    });
  }

  private async findIdempotentReplay(
    scopedKey: string,
    input: {
      actor: User;
      userId: string;
      action: "SUSPEND" | "RESTORE";
      reasonCode: string;
      reason: string;
    },
  ): Promise<AccountModerationDecisionDto | null> {
    const existing = await this.db.accountModerationDecision.findUnique({
      where: { idempotencyKey: scopedKey },
    });
    if (!existing) {
      return null;
    }
    if (
      existing.userId !== input.userId ||
      existing.actorUserId !== input.actor.id ||
      existing.action !== input.action ||
      existing.reasonCode !== input.reasonCode ||
      existing.reason !== input.reason
    ) {
      throw new AppError("CONFLICT", "Idempotency key reused with different payload", 409);
    }
    const user = await this.db.user.findUnique({
      where: { id: existing.userId },
      select: { suspendedAt: true, accountStatus: true },
    });
    return mapDecision({
      ...existing,
      resultingAccountStatus: user?.accountStatus ?? existing.resultingAccountStatus,
      suspendedAt: user?.suspendedAt ?? null,
      idempotentReplay: true,
      sessionsRevoked: true,
    });
  }

  /**
   * Immediate socket eviction after a committed SUSPEND only.
   * Must never run inside the transaction; failures must not fail the HTTP decision.
   */
  private async applyPostCommitRestrictionEffects(
    action: "SUSPEND" | "RESTORE",
    userId: string,
  ): Promise<void> {
    if (action !== "SUSPEND") {
      return;
    }
    try {
      await this.restrictionSideEffects(userId);
    } catch (error) {
      restrictionSideEffectLog.warn(
        {
          event: "admin_account_restriction_side_effects_failed",
          userId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
        "Account restriction side effects failed after committed suspend",
      );
    }
  }
}
