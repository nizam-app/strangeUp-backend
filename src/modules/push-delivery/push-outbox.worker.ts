import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import type { PushOutboxStatus } from "../../../generated/prisma/client.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { FcmSender } from "./fcm-sender.js";
import { resolveFcmSender } from "./fcm-sender.js";
import { loadEligiblePushDevices, type PushSkipReason } from "./push-eligibility.js";
import { buildPrivacySafePushPayload } from "./push-payload.js";

export type PushOutboxWorkerHandle = {
  stop: () => void;
  /** Test hook — process one batch synchronously. */
  runOnce: () => Promise<void>;
};

function computeBackoffMs(attemptCount: number, baseMs: number): number {
  const capped = Math.min(attemptCount, 8);
  return baseMs * 2 ** capped;
}

function truncateError(message: string, max = 500): string {
  return message.length <= max ? message : `${message.slice(0, max - 3)}...`;
}

export async function recoverStalePushOutboxLocks(
  db: DatabaseClient,
  lockTtlMs: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - lockTtlMs);
  const result = await db.pushNotificationOutbox.updateMany({
    where: {
      status: "PROCESSING",
      lockedAt: { lt: cutoff },
    },
    data: {
      status: "PENDING",
      lockedAt: null,
      lockedBy: null,
    },
  });
  return result.count;
}

type ClaimedRow = {
  id: string;
  userNotificationId: string;
  recipientId: string;
  attemptCount: number;
};

async function claimOutboxBatch(
  db: DatabaseClient,
  workerId: string,
  batchSize: number,
): Promise<ClaimedRow[]> {
  return db.$transaction(async (tx) => {
    const pending = await tx.$queryRaw<ClaimedRow[]>`
      SELECT id, "userNotificationId", "recipientId", "attemptCount"
      FROM "PushNotificationOutbox"
      WHERE status = 'PENDING'::"PushOutboxStatus"
        AND "nextAttemptAt" <= NOW()
      ORDER BY "nextAttemptAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `;
    if (pending.length === 0) {
      return [];
    }
    const ids = pending.map((r) => r.id);
    await tx.pushNotificationOutbox.updateMany({
      where: { id: { in: ids } },
      data: {
        status: "PROCESSING",
        lockedAt: new Date(),
        lockedBy: workerId,
      },
    });
    return pending;
  });
}

async function markOutbox(
  db: DatabaseClient,
  id: string,
  data: {
    status: PushOutboxStatus;
    attemptCount?: number;
    nextAttemptAt?: Date;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    sentAt?: Date | null;
  },
): Promise<void> {
  await db.pushNotificationOutbox.update({
    where: { id },
    data: {
      ...data,
      lockedAt: null,
      lockedBy: null,
    },
  });
}

async function processOutboxRow(
  db: DatabaseClient,
  env: AppEnv,
  fcmSender: FcmSender,
  row: ClaimedRow,
  logger: Logger,
): Promise<void> {
  const notification = await db.userNotification.findUnique({
    where: { id: row.userNotificationId },
    select: {
      id: true,
      type: true,
      sourceId: true,
      recipientId: true,
      createdAt: true,
    },
  });
  if (!notification) {
    await markOutbox(db, row.id, {
      status: "FAILED",
      lastErrorCode: "NOTIFICATION_MISSING",
      lastErrorMessage: "Source notification row missing",
    });
    return;
  }

  if (env.PUSH_MAX_NOTIFICATION_AGE_SECONDS > 0) {
    const maxAgeMs = env.PUSH_MAX_NOTIFICATION_AGE_SECONDS * 1000;
    const ageMs = Date.now() - notification.createdAt.getTime();
    if (ageMs > maxAgeMs) {
      await markOutbox(db, row.id, {
        status: "SKIPPED",
        lastErrorCode: "STALE_NOTIFICATION",
        lastErrorMessage: skipReasonMessage("STALE_NOTIFICATION"),
      });
      return;
    }
  }

  const eligibility = await loadEligiblePushDevices(
    db,
    env,
    notification.recipientId,
    notification.type,
  );

  if (!eligibility.ok) {
    await markOutbox(db, row.id, {
      status: "SKIPPED",
      lastErrorCode: eligibility.reason,
      lastErrorMessage: skipReasonMessage(eligibility.reason),
    });
    return;
  }

  const payload = buildPrivacySafePushPayload({
    notificationId: notification.id,
    type: notification.type,
    sourceId: notification.sourceId,
  });

  let anySent = false;
  let lastTransient: string | null = null;
  let lastPermanent: string | null = null;

  for (const device of eligibility.devices) {
    const result = await fcmSender.send(payload, {
      deviceTokenId: device.id,
      registrationToken: device.registrationToken,
    });

    if (result.outcome === "sent") {
      anySent = true;
      continue;
    }
    if (result.outcome === "skipped") {
      await markOutbox(db, row.id, {
        status: "SKIPPED",
        lastErrorCode: result.reason,
        lastErrorMessage: result.reason,
      });
      return;
    }
    if (result.outcome === "invalid_token") {
      await db.userDeviceToken.update({
        where: { id: device.id },
        data: { revokedAt: new Date() },
      });
      continue;
    }
    if (result.outcome === "transient_error") {
      lastTransient = result.code;
      continue;
    }
    if (result.outcome === "permanent_error") {
      lastPermanent = result.code;
    }
  }

  if (anySent) {
    await markOutbox(db, row.id, {
      status: "SENT",
      sentAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    return;
  }

  const nextAttempt = row.attemptCount + 1;
  if (lastTransient && nextAttempt < env.PUSH_MAX_ATTEMPTS) {
    await markOutbox(db, row.id, {
      status: "PENDING",
      attemptCount: nextAttempt,
      nextAttemptAt: new Date(Date.now() + computeBackoffMs(nextAttempt, env.PUSH_RETRY_BASE_MS)),
      lastErrorCode: lastTransient,
      lastErrorMessage: truncateError(`Transient FCM error: ${lastTransient}`),
    });
    return;
  }

  if (nextAttempt >= env.PUSH_MAX_ATTEMPTS) {
    await markOutbox(db, row.id, {
      status: "FAILED",
      attemptCount: nextAttempt,
      lastErrorCode: lastPermanent ?? lastTransient ?? "DELIVERY_EXHAUSTED",
      lastErrorMessage: truncateError("Push delivery attempts exhausted"),
    });
    logger.warn({ outboxId: row.id, notificationId: row.userNotificationId }, "push outbox failed");
    return;
  }

  await markOutbox(db, row.id, {
    status: "SKIPPED",
    lastErrorCode: "NO_DELIVERABLE_DEVICES",
    lastErrorMessage: "All device tokens invalid or unavailable",
  });
}

function skipReasonMessage(reason: PushSkipReason): string {
  switch (reason) {
    case "PUSH_DISABLED":
      return "Push delivery disabled (PUSH_ENABLED=false)";
    case "STALE_NOTIFICATION":
      return "Notification exceeded push max age (prevents historical backlog on activation)";
    case "ACCOUNT_INELIGIBLE":
      return "Recipient account not eligible for push";
    case "PUSH_OPT_OUT":
      return "Recipient disabled push notifications";
    case "CATEGORY_DISABLED":
      return "Recipient disabled this notification category";
    case "NO_DEVICES":
      return "No active device registrations";
    default:
      return reason;
  }
}

export async function processPushOutboxBatch(deps: {
  db: DatabaseClient;
  env: AppEnv;
  fcmSender: FcmSender;
  logger: Logger;
  workerId?: string;
}): Promise<number> {
  await recoverStalePushOutboxLocks(deps.db, deps.env.PUSH_OUTBOX_LOCK_TTL_MS);
  const workerId = deps.workerId ?? randomUUID();
  const claimed = await claimOutboxBatch(deps.db, workerId, deps.env.PUSH_WORKER_BATCH_SIZE);
  for (const row of claimed) {
    await processOutboxRow(deps.db, deps.env, deps.fcmSender, row, deps.logger);
  }
  return claimed.length;
}

export function startPushOutboxWorker(deps: {
  db: DatabaseClient;
  env: AppEnv;
  logger: Logger;
  fcmSender?: FcmSender;
}): PushOutboxWorkerHandle {
  let stopped = false;
  let fcmSenderPromise: Promise<FcmSender> | null = null;

  const getSender = (): Promise<FcmSender> => {
    if (deps.fcmSender) {
      return Promise.resolve(deps.fcmSender);
    }
    if (!fcmSenderPromise) {
      fcmSenderPromise = resolveFcmSender(deps.env, deps.logger);
    }
    return fcmSenderPromise;
  };

  const runOnce = async (): Promise<void> => {
    if (stopped || !deps.env.PUSH_WORKER_ENABLED) {
      return;
    }
    try {
      const sender = await getSender();
      await processPushOutboxBatch({
        db: deps.db,
        env: deps.env,
        fcmSender: sender,
        logger: deps.logger,
      });
    } catch (err: unknown) {
      deps.logger.error({ err }, "push outbox worker batch error");
    }
  };

  const timer = setInterval(() => {
    void runOnce();
  }, deps.env.PUSH_WORKER_INTERVAL_MS);
  timer.unref?.();

  void runOnce();

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
    runOnce,
  };
}
