import { createHash } from "node:crypto";
import type { ActivityStatus, User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import {
  ACTIVITY_PARTICIPATION_STATES_CLOSED_ON_CANCEL,
  applyActivityCancellationRecords,
} from "../activities/activity-cancellation.js";
import {
  resolveActivityCancellationCapabilities,
  type ActivityCancellationCapabilities,
} from "./admin-activity-cancellation.policy.js";
import { adminActivityCancelIdempotencyKeySchema } from "./admin-activity-cancellation.validation.js";
import { userIsActiveSuperAdmin } from "./platform-staff-policy.js";

export type ActivityCancellationDecisionDto = {
  activityId: string;
  action: "CANCEL";
  status: ActivityStatus;
  cancelledAt: string | null;
  previousActivityStatus: ActivityStatus;
  resultingActivityStatus: ActivityStatus;
  reasonCode: string;
  reason: string;
  actorUserId: string;
  decisionId: string;
  createdAt: string;
  idempotentReplay: boolean;
  confirmedClosedCount: number;
  waitlistedClosedCount: number;
  pendingClosedCount: number;
  notificationsSent: false;
  refundsIssued: false;
  participantRecordsDeleted: false;
};

type ActivityTargetRow = {
  id: string;
  hostId: string;
  status: ActivityStatus;
  cancelledAt: Date | null;
  updatedAt: Date;
};

type TransactionClient = Parameters<Parameters<DatabaseClient["$transaction"]>[0]>[0];

function scopedIdempotencyKey(input: {
  actorUserId: string;
  activityId: string;
  headerKey: string;
  reasonCode: string;
  reason: string;
}): string {
  const digest = createHash("sha256")
    .update(
      [
        "activity-moderation",
        "CANCEL",
        input.actorUserId,
        input.activityId,
        input.headerKey,
        input.reasonCode,
        input.reason,
      ].join(":"),
      "utf8",
    )
    .digest("hex");
  return `activity-moderation:${digest}`;
}

function mapDecision(row: {
  id: string;
  activityId: string;
  actorUserId: string;
  reasonCode: string;
  reason: string;
  previousActivityStatus: ActivityStatus;
  resultingActivityStatus: ActivityStatus;
  confirmedClosedCount: number;
  waitlistedClosedCount: number;
  pendingClosedCount: number;
  createdAt: Date;
  cancelledAt: Date | null;
  idempotentReplay: boolean;
}): ActivityCancellationDecisionDto {
  return {
    activityId: row.activityId,
    action: "CANCEL",
    status: row.resultingActivityStatus,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    previousActivityStatus: row.previousActivityStatus,
    resultingActivityStatus: row.resultingActivityStatus,
    reasonCode: row.reasonCode,
    reason: row.reason,
    actorUserId: row.actorUserId,
    decisionId: row.id,
    createdAt: row.createdAt.toISOString(),
    idempotentReplay: row.idempotentReplay,
    confirmedClosedCount: row.confirmedClosedCount,
    waitlistedClosedCount: row.waitlistedClosedCount,
    pendingClosedCount: row.pendingClosedCount,
    notificationsSent: false,
    refundsIssued: false,
    participantRecordsDeleted: false,
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

function isPrismaMissingTable(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2021"
  );
}

function throwAuditStorageUnavailable(cause?: unknown): never {
  throw new AppError(
    "SERVICE_UNAVAILABLE",
    "Activity cancellation audit storage is not available",
    503,
    cause ? { cause } : undefined,
  );
}

function emptyClosedCounts() {
  return { confirmedClosedCount: 0, waitlistedClosedCount: 0, pendingClosedCount: 0 };
}

export class AdminActivityCancellationService {
  constructor(private readonly db: DatabaseClient) {}

  async cancelActivity(input: {
    actor: User;
    activityId: string;
    reasonCode: string;
    reason: string;
    expectedStatus?: ActivityStatus;
    idempotencyKey?: string;
  }): Promise<ActivityCancellationDecisionDto> {
    const headerKey = input.idempotencyKey
      ? adminActivityCancelIdempotencyKeySchema.parse(input.idempotencyKey)
      : undefined;
    const scopedKey = headerKey
      ? scopedIdempotencyKey({
          actorUserId: input.actor.id,
          activityId: input.activityId,
          headerKey,
          reasonCode: input.reasonCode,
          reason: input.reason,
        })
      : null;

    if (scopedKey) {
      const replay = await this.findIdempotentReplay(scopedKey, input);
      if (replay) {
        return replay;
      }
    }

    try {
      return await this.db.$transaction(async (tx) => {
        await this.assertActorIsSuperAdmin(tx, input.actor.id);

        const target = await tx.activity.findUnique({
          where: { id: input.activityId },
          select: {
            id: true,
            hostId: true,
            status: true,
            cancelledAt: true,
            updatedAt: true,
          },
        });
        if (!target) {
          throw new AppError("NOT_FOUND", "Activity not found", 404);
        }

        const capabilities = resolveActivityCancellationCapabilities({
          actorUserId: input.actor.id,
          actorIsSuperAdmin: true,
          target: {
            activityId: target.id,
            hostId: target.hostId,
            status: target.status,
          },
        });
        this.assertCapability(capabilities);

        if (input.expectedStatus && input.expectedStatus !== target.status) {
          throw new AppError(
            "CONFLICT",
            "Activity status changed. Reload the activity and try again.",
            409,
          );
        }

        return this.executeCancel(tx, {
          actor: input.actor,
          target,
          reasonCode: input.reasonCode,
          reason: input.reason,
          scopedKey,
        });
      });
    } catch (error) {
      if (isPrismaMissingTable(error)) {
        throwAuditStorageUnavailable(error);
      }
      if (isPrismaUniqueConflict(error) && scopedKey) {
        const replay = await this.findIdempotentReplay(scopedKey, input);
        if (replay) {
          return replay;
        }
        throw new AppError("CONFLICT", "Idempotency key reused with different payload", 409);
      }
      if (isPrismaSerializationFailure(error)) {
        throw new AppError(
          "CONFLICT",
          "Activity status changed. Reload the activity and try again.",
          409,
        );
      }
      throw error;
    }
  }

  private async executeCancel(
    tx: TransactionClient,
    input: {
      actor: User;
      target: ActivityTargetRow;
      reasonCode: string;
      reason: string;
      scopedKey: string | null;
    },
  ): Promise<ActivityCancellationDecisionDto> {
    const now = new Date();
    await tx.$executeRaw`SELECT 1 FROM "Activity" WHERE "id" = ${input.target.id} FOR UPDATE`;
    const locked = await tx.activity.findUnique({
      where: { id: input.target.id },
      select: {
        id: true,
        hostId: true,
        status: true,
        cancelledAt: true,
        updatedAt: true,
      },
    });
    if (!locked) {
      throw new AppError("NOT_FOUND", "Activity not found", 404);
    }
    if (
      locked.status !== input.target.status ||
      locked.updatedAt.getTime() !== input.target.updatedAt.getTime()
    ) {
      throw new AppError(
        "CONFLICT",
        "Activity status changed. Reload the activity and try again.",
        409,
      );
    }

    const lockedCapabilities = resolveActivityCancellationCapabilities({
      actorUserId: input.actor.id,
      actorIsSuperAdmin: true,
      target: {
        activityId: locked.id,
        hostId: locked.hostId,
        status: locked.status,
      },
    });
    this.assertCapability(lockedCapabilities);

    const closedCounts = await this.countOpenParticipations(tx, locked.id);
    await applyActivityCancellationRecords(tx, {
      activityId: locked.id,
      now,
    });

    try {
      const decision = await tx.activityModerationDecision.create({
        data: {
          activityId: input.target.id,
          actorUserId: input.actor.id,
          action: "CANCEL",
          reasonCode: input.reasonCode,
          reason: input.reason,
          previousActivityStatus: input.target.status,
          resultingActivityStatus: "CANCELLED",
          confirmedClosedCount: closedCounts.confirmedClosedCount,
          waitlistedClosedCount: closedCounts.waitlistedClosedCount,
          pendingClosedCount: closedCounts.pendingClosedCount,
          idempotencyKey: input.scopedKey,
        },
      });

      return mapDecision({
        ...decision,
        cancelledAt: now,
        idempotentReplay: false,
      });
    } catch (error) {
      if (isPrismaMissingTable(error)) {
        throwAuditStorageUnavailable(error);
      }
      throw error;
    }
  }

  private async countOpenParticipations(tx: TransactionClient, activityId: string) {
    const grouped = await tx.activityParticipation.groupBy({
      by: ["state"],
      where: {
        activityId,
        state: { in: [...ACTIVITY_PARTICIPATION_STATES_CLOSED_ON_CANCEL] },
      },
      _count: { _all: true },
    });
    const counts = emptyClosedCounts();
    for (const row of grouped) {
      if (row.state === "CONFIRMED") {
        counts.confirmedClosedCount = row._count._all;
      } else if (row.state === "WAITLISTED") {
        counts.waitlistedClosedCount = row._count._all;
      } else if (row.state === "PENDING") {
        counts.pendingClosedCount = row._count._all;
      }
    }
    return counts;
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

  private assertCapability(capabilities: ActivityCancellationCapabilities): void {
    if (capabilities.canCancel) {
      return;
    }
    if (capabilities.blockedReason === "HOST_OWN_ACTIVITY") {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Administrative cancellation cannot be used for your own hosted activity",
        403,
      );
    }
    if (capabilities.blockedReason === "NOT_SUPER_ADMIN") {
      throw new AppError("AUTH_FORBIDDEN", "Super administrator access required", 403);
    }
    if (capabilities.blockedReason === "ALREADY_CANCELLED") {
      throw new AppError("CONFLICT", "Activity is already cancelled", 409);
    }
    if (capabilities.blockedReason === "COMPLETED") {
      throw new AppError("CONFLICT", "Completed activities cannot be cancelled", 409);
    }
    throw new AppError("CONFLICT", "Activity cannot be cancelled from the current status", 409);
  }

  private async findIdempotentReplay(
    scopedKey: string,
    input: {
      actor: User;
      activityId: string;
      reasonCode: string;
      reason: string;
    },
  ): Promise<ActivityCancellationDecisionDto | null> {
    let existing;
    try {
      existing = await this.db.activityModerationDecision.findUnique({
        where: { idempotencyKey: scopedKey },
      });
    } catch (error) {
      if (isPrismaMissingTable(error)) {
        throwAuditStorageUnavailable(error);
      }
      throw error;
    }
    if (!existing) {
      return null;
    }
    if (
      existing.activityId !== input.activityId ||
      existing.actorUserId !== input.actor.id ||
      existing.action !== "CANCEL" ||
      existing.reasonCode !== input.reasonCode ||
      existing.reason !== input.reason
    ) {
      throw new AppError("CONFLICT", "Idempotency key reused with different payload", 409);
    }
    const activity = await this.db.activity.findUnique({
      where: { id: existing.activityId },
      select: { cancelledAt: true, status: true },
    });
    return mapDecision({
      ...existing,
      resultingActivityStatus: activity?.status ?? existing.resultingActivityStatus,
      cancelledAt: activity?.cancelledAt ?? null,
      idempotentReplay: true,
    });
  }
}
