import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import pino from "pino";
import { randomUUID } from "node:crypto";
import { createApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import {
  createPrismaClient,
  disconnectPrisma,
  type DatabaseClient,
} from "../../src/infrastructure/database/prisma.js";
import { createCapturingEmailSender } from "../helpers/capturing-email-sender.js";
import { createIntegrationUser } from "../helpers/integration-user.js";
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";
import { MockFcmSender } from "../../src/modules/push-delivery/fcm-sender.js";
import { processPushOutboxBatch } from "../../src/modules/push-delivery/push-outbox.worker.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";
const describePref = runIntegration ? describe : describe.skip;

describePref("integration: notification preference push enforcement (Task 023E)", () => {
  let db: DatabaseClient;
  let app: ReturnType<typeof createApp>;
  const emailSender = createCapturingEmailSender();

  beforeAll(() => {
    const url = process.env.INTEGRATION_DATABASE_URL?.trim();
    if (!url) {
      throw new Error("INTEGRATION_DATABASE_URL required");
    }
    db = createPrismaClient(url);
    const env = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: url,
      CORS_ORIGINS: "http://localhost:3000",
      JWT_ACCESS_SECRET: "test-jwt-access-secret-min-32-chars!!",
      PROFILE_UPLOAD_DIR: ".data/test-avatars",
      ACTIVITY_UPLOAD_DIR: ".data/test-activity-media",
      PUSH_ENABLED: "false",
    });
    app = createApp({ env, logger: pino({ level: "silent" }), db, emailSender });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeEach(() => {
    clearRateLimits();
    emailSender.clear();
  });

  it("T023E-N01 direct message push skipped when directMessagesEnabled=false", async () => {
    const envEnabled = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: process.env.INTEGRATION_DATABASE_URL!,
      CORS_ORIGINS: "http://localhost:3000",
      JWT_ACCESS_SECRET: "test-jwt-access-secret-min-32-chars!!",
      PROFILE_UPLOAD_DIR: ".data/test-avatars",
      ACTIVITY_UPLOAD_DIR: ".data/test-activity-media",
      PUSH_ENABLED: "true",
    });

    const user = await createIntegrationUser(app, emailSender, db, "t023e-pref", {
      mainAppAccess: true,
    });
    await request(app)
      .patch("/v1/me/notification-preferences")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ directMessagesEnabled: false });

    await request(app)
      .post("/v1/me/device-tokens")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        platform: "android",
        registrationToken: "fcm-pref-token-012345678901234567890123",
        deviceBindingId: `t023e-pref-${randomUUID()}`,
      });

    const notificationId = randomUUID();
    await db.userNotification.create({
      data: {
        id: notificationId,
        recipientId: user.userId,
        type: "DIRECT_MESSAGE_RECEIVED",
        title: "t",
        body: "b",
        dedupeKey: `t023e-pref:${randomUUID()}`,
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
      env: envEnabled,
      fcmSender: mock,
      logger: pino({ level: "silent" }),
    });

    expect(mock.sent).toHaveLength(0);
    const row = await db.pushNotificationOutbox.findUniqueOrThrow({ where: { id: outboxId } });
    expect(row.status).toBe("SKIPPED");
    expect(row.lastErrorCode).toBe("CATEGORY_DISABLED");
  });
});
