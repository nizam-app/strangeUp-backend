import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import pino from "pino";
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

const runIntegration = process.env.RUN_INTEGRATION === "1";

const describePush = runIntegration ? describe : describe.skip;

describePush("integration: push devices & preferences (Task 023C)", () => {
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
    app = createApp({
      env,
      logger: pino({ level: "silent" }),
      db,
      emailSender,
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeEach(() => {
    clearRateLimits();
    emailSender.clear();
  });

  it("T023C-P01 register/list/revoke own device token; raw token not returned", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "t023c-dev", {
      mainAppAccess: true,
    });
    const register = await request(app)
      .post("/v1/me/device-tokens")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        platform: "android",
        registrationToken: "fcm-test-token-012345678901234567890",
        deviceBindingId: "pixel-7-stable-id",
      });
    expect(register.status).toBe(200);
    expect(register.body.data.deviceTokenId).toBeTruthy();
    expect(register.body.data).not.toHaveProperty("registrationToken");

    const list = await request(app)
      .get("/v1/me/device-tokens")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(list.body.data.devices).toHaveLength(1);

    const revoke = await request(app)
      .delete(`/v1/me/device-tokens/${register.body.data.deviceTokenId}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(revoke.body.data.revoked).toBe(true);

    const after = await request(app)
      .get("/v1/me/device-tokens")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(after.body.data.devices).toHaveLength(0);
  });

  it("T023C-N01 cannot revoke another user's device token", async () => {
    const a = await createIntegrationUser(app, emailSender, db, "t023c-own-a", {
      mainAppAccess: true,
    });
    const b = await createIntegrationUser(app, emailSender, db, "t023c-own-b", {
      mainAppAccess: true,
    });
    const reg = await request(app)
      .post("/v1/me/device-tokens")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({
        platform: "ios",
        registrationToken: "apns-test-token-012345678901234567890",
        deviceBindingId: "iphone-stable-id",
      });
    const denied = await request(app)
      .delete(`/v1/me/device-tokens/${reg.body.data.deviceTokenId}`)
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(denied.status).toBe(404);
  });

  it("T023C-P02 notification preferences defaults and patch; pending user denied", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "t023c-pref", {
      mainAppAccess: true,
    });
    const get = await request(app)
      .get("/v1/me/notification-preferences")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(get.status).toBe(200);
    expect(get.body.data.deliveryStatus).toBe("PUSH_DISABLED");
    expect(get.body.data.groupChatEnabled).toBe(false);
    expect(get.body.data.marketingEnabled).toBe(false);

    const patch = await request(app)
      .patch("/v1/me/notification-preferences")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ marketingEnabled: true, groupChatEnabled: true });
    expect(patch.body.data.marketingEnabled).toBe(true);
    expect(patch.body.data.groupChatEnabled).toBe(true);

    const pending = await createIntegrationUser(app, emailSender, db, "t023c-pend", {
      mainAppAccess: false,
    });
    const denied = await request(app)
      .get("/v1/me/notification-preferences")
      .set("Authorization", `Bearer ${pending.accessToken}`);
    expect(denied.status).toBe(403);
  });

  it("T023C-P03 logout revokes session-bound device tokens", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "t023c-logout", {
      mainAppAccess: true,
    });
    const reg = await request(app)
      .post("/v1/me/device-tokens")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        platform: "android",
        registrationToken: "fcm-logout-token-012345678901234567890",
        deviceBindingId: "logout-device-id",
      });
    expect(reg.status).toBe(200);

    const bound = await db.userDeviceToken.findUnique({
      where: { id: reg.body.data.deviceTokenId },
      select: { sessionId: true },
    });
    expect(bound?.sessionId).toBeTruthy();

    await request(app).post("/v1/auth/logout").set("Authorization", `Bearer ${user.accessToken}`);

    const denied = await request(app)
      .get("/v1/me/device-tokens")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(denied.status).toBe(401);

    const revokedCount = await db.userDeviceToken.count({
      where: { userId: user.userId, revokedAt: { not: null } },
    });
    expect(revokedCount).toBe(1);
  });
});
