import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import pino from "pino";
import { randomUUID } from "node:crypto";
import { createApp } from "../../src/app.js";
import { loadEnv, type AppEnv } from "../../src/config/env.js";
import {
  createPrismaClient,
  disconnectPrisma,
  type DatabaseClient,
} from "../../src/infrastructure/database/prisma.js";
import { createCapturingEmailSender } from "../helpers/capturing-email-sender.js";
import { createIntegrationUser } from "../helpers/integration-user.js";
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";
import { NotificationEmitter } from "../../src/modules/notifications/notification-emitter.service.js";
import { MockFcmSender } from "../../src/modules/push-delivery/fcm-sender.js";
import { processPushOutboxBatch } from "../../src/modules/push-delivery/push-outbox.worker.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";
const describePushOutbox = runIntegration ? describe : describe.skip;

function baseEnvOverrides(): Record<string, string> {
  return {
    NODE_ENV: "test",
    DATABASE_URL: process.env.INTEGRATION_DATABASE_URL!,
    CORS_ORIGINS: "http://localhost:3000",
    JWT_ACCESS_SECRET: "test-jwt-access-secret-min-32-chars!!",
    PROFILE_UPLOAD_DIR: ".data/test-avatars",
    ACTIVITY_UPLOAD_DIR: ".data/test-activity-media",
    PUSH_ENABLED: "false",
  };
}

describePushOutbox("integration: push outbox worker (Task 023D)", () => {
  let db: DatabaseClient;
  let app: ReturnType<typeof createApp>;
  let envDisabled: AppEnv;
  let envEnabled: AppEnv;
  const emailSender = createCapturingEmailSender();

  beforeAll(() => {
    const url = process.env.INTEGRATION_DATABASE_URL?.trim();
    if (!url) {
      throw new Error("INTEGRATION_DATABASE_URL required");
    }
    db = createPrismaClient(url);
    envDisabled = loadEnv(baseEnvOverrides());
    envEnabled = loadEnv({ ...baseEnvOverrides(), PUSH_ENABLED: "true" });
    app = createApp({ env: envDisabled, logger: pino({ level: "silent" }), db, emailSender });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeEach(() => {
    clearRateLimits();
    emailSender.clear();
  });

  it("T023D-P01 PUSH_ENABLED=false marks outbox SKIPPED (no FCM send)", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "t023d-skip", {
      mainAppAccess: true,
    });
    const emitter = new NotificationEmitter(db);
    await emitter.emit({
      recipientId: user.userId,
      type: "MESSAGE_REQUEST_RECEIVED",
      title: "Private title",
      body: "Private body must not appear in push",
      dedupeKey: `t023d-skip:${randomUUID()}`,
    });

    const outbox = await db.pushNotificationOutbox.findFirst({
      where: { recipientId: user.userId },
      orderBy: { createdAt: "desc" },
    });
    expect(outbox?.status).toBe("PENDING");

    const mock = new MockFcmSender();
    await processPushOutboxBatch({
      db,
      env: envDisabled,
      fcmSender: mock,
      logger: pino({ level: "silent" }),
    });

    const updated = await db.pushNotificationOutbox.findUniqueOrThrow({
      where: { id: outbox!.id },
    });
    expect(updated.status).toBe("SKIPPED");
    expect(updated.lastErrorCode).toBe("PUSH_DISABLED");
    expect(mock.sent).toHaveLength(0);
  });

  it("T023D-P02 PUSH_ENABLED=true delivers via mock FCM with privacy-safe data only", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "t023d-send", {
      mainAppAccess: true,
    });
    const reg = await request(app)
      .post("/v1/me/device-tokens")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        platform: "android",
        registrationToken: "fcm-integration-token-012345678901234567890",
        deviceBindingId: `t023d-pixel-${randomUUID()}`,
      });
    expect(reg.status).toBe(200);

    const notificationId = randomUUID();
    await db.userNotification.create({
      data: {
        id: notificationId,
        recipientId: user.userId,
        type: "DIRECT_MESSAGE_RECEIVED",
        title: "Sensitive title",
        body: "Sensitive message body",
        dedupeKey: `t023d-send:${randomUUID()}`,
      },
    });
    await db.pushNotificationOutbox.create({
      data: {
        id: randomUUID(),
        userNotificationId: notificationId,
        recipientId: user.userId,
      },
    });

    const mock = new MockFcmSender();
    const claimed = await processPushOutboxBatch({
      db,
      env: envEnabled,
      fcmSender: mock,
      logger: pino({ level: "silent" }),
    });
    expect(claimed).toBeGreaterThanOrEqual(1);
    expect(mock.sent).toHaveLength(1);
    expect(mock.sent[0]?.data.type).toBe("DIRECT_MESSAGE_RECEIVED");
    expect(mock.sent[0]?.data.notificationId).toBe(notificationId);
    expect(JSON.stringify(mock.sent[0]?.data)).not.toContain("Sensitive");

    const row = await db.pushNotificationOutbox.findFirstOrThrow({
      where: { userNotificationId: notificationId },
    });
    expect(row.status).toBe("SENT");
  });

  it("T023E-P01 stale notification skipped when exceeding max age (backlog guard)", async () => {
    const envEnabledShortAge = loadEnv({
      ...baseEnvOverrides(),
      PUSH_ENABLED: "true",
      PUSH_MAX_NOTIFICATION_AGE_SECONDS: "60",
    });
    const user = await createIntegrationUser(app, emailSender, db, "t023e-stale", {
      mainAppAccess: true,
    });
    await request(app)
      .post("/v1/me/device-tokens")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        platform: "android",
        registrationToken: "fcm-stale-token-01234567890123456789012",
        deviceBindingId: `t023e-stale-${randomUUID()}`,
      });

    const notificationId = randomUUID();
    const oldCreated = new Date(Date.now() - 120_000);
    await db.userNotification.create({
      data: {
        id: notificationId,
        recipientId: user.userId,
        type: "MESSAGE_REQUEST_RECEIVED",
        title: "old",
        body: "old",
        dedupeKey: `t023e-stale:${randomUUID()}`,
        createdAt: oldCreated,
      },
    });
    const outboxId = randomUUID();
    await db.pushNotificationOutbox.create({
      data: {
        id: outboxId,
        userNotificationId: notificationId,
        recipientId: user.userId,
      },
    });

    const mock = new MockFcmSender();
    await processPushOutboxBatch({
      db,
      env: envEnabledShortAge,
      fcmSender: mock,
      logger: pino({ level: "silent" }),
    });

    expect(mock.sent).toHaveLength(0);
    const row = await db.pushNotificationOutbox.findUniqueOrThrow({ where: { id: outboxId } });
    expect(row.status).toBe("SKIPPED");
    expect(row.lastErrorCode).toBe("STALE_NOTIFICATION");
  });

  it("T023E-P02 already-SENT outbox row is not claimed again (no duplicate delivery)", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "t023e-dedupe", {
      mainAppAccess: true,
    });
    const notificationId = randomUUID();
    await db.userNotification.create({
      data: {
        id: notificationId,
        recipientId: user.userId,
        type: "MESSAGE_REQUEST_RECEIVED",
        title: "t",
        body: "b",
        dedupeKey: `t023e-dedupe:${randomUUID()}`,
      },
    });
    const outboxId = randomUUID();
    await db.pushNotificationOutbox.create({
      data: {
        id: outboxId,
        userNotificationId: notificationId,
        recipientId: user.userId,
        status: "SENT",
        sentAt: new Date(),
      },
    });

    const mock = new MockFcmSender();
    const claimed = await processPushOutboxBatch({
      db,
      env: envEnabled,
      fcmSender: mock,
      logger: pino({ level: "silent" }),
    });
    expect(claimed).toBe(0);
    expect(mock.sent).toHaveLength(0);
  });

  it("T023D-P03 invalid device token revoked; outbox SKIPPED when no devices remain", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "t023d-inv", {
      mainAppAccess: true,
    });
    const reg = await request(app)
      .post("/v1/me/device-tokens")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        platform: "ios",
        registrationToken: "fcm-invalid-token-012345678901234567890",
        deviceBindingId: `t023d-iphone-${randomUUID()}`,
      });
    expect(reg.status).toBe(200);
    const deviceTokenId = reg.body.data.deviceTokenId as string;

    const notificationId = randomUUID();
    await db.userNotification.create({
      data: {
        id: notificationId,
        recipientId: user.userId,
        type: "MESSAGE_REQUEST_RECEIVED",
        title: "t",
        body: "b",
        dedupeKey: `t023d-inv:${randomUUID()}`,
      },
    });
    const outboxId = randomUUID();
    await db.pushNotificationOutbox.create({
      data: {
        id: outboxId,
        userNotificationId: notificationId,
        recipientId: user.userId,
      },
    });

    const mock = new MockFcmSender();
    mock.invalidTokenIds.add(deviceTokenId);
    await processPushOutboxBatch({
      db,
      env: envEnabled,
      fcmSender: mock,
      logger: pino({ level: "silent" }),
    });

    const device = await db.userDeviceToken.findUniqueOrThrow({ where: { id: deviceTokenId } });
    expect(device.revokedAt).not.toBeNull();

    const row = await db.pushNotificationOutbox.findUniqueOrThrow({ where: { id: outboxId } });
    expect(row.status).toBe("SKIPPED");
  });
});
