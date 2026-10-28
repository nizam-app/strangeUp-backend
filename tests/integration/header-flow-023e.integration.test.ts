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
import { applyAccountRestrictionSideEffects } from "../../src/modules/account/account-restriction.side-effects.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";
const describeHeader = runIntegration ? describe : describe.skip;

describeHeader("integration: Header Flow parity gates (Task 023E)", () => {
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

  it("T023E-G01 onboarding-only user cannot access messaging summary or notifications", async () => {
    const pending = await createIntegrationUser(app, emailSender, db, "t023e-gate", {
      mainAppAccess: false,
    });
    const summary = await request(app)
      .get("/v1/me/messaging/summary")
      .set("Authorization", `Bearer ${pending.accessToken}`);
    expect(summary.status).toBe(403);

    const notifications = await request(app)
      .get("/v1/me/notifications")
      .set("Authorization", `Bearer ${pending.accessToken}`);
    expect(notifications.status).toBe(403);
  });

  it("T023E-G02 activated user receives messaging summary and home notification count", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "t023e-home", {
      mainAppAccess: true,
    });
    const summary = await request(app)
      .get("/v1/me/messaging/summary")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.data).toHaveProperty("displayBadgeCount");

    const home = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(home.status).toBe(200);
    expect(typeof home.body.data.notificationsUnreadCount).toBe("number");
  });

  it("T023E-G03 account restriction side-effect hook is callable (admin suspend writer deferred)", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "t023e-restrict", {
      mainAppAccess: true,
    });
    await expect(applyAccountRestrictionSideEffects(user.userId)).resolves.toBeUndefined();
  });
});
