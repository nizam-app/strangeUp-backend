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

const describe025a = runIntegration ? describe : describe.skip;

describe025a("integration: main flow 025A home main-shell (Task 025A)", () => {
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
      GROUP_UPLOAD_DIR: ".data/test-group-media",
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

  it("T025A-H01 pending activation cannot load home (Task 022 gate)", async () => {
    const pending = await createIntegrationUser(app, emailSender, db, "t025a-pending", {
      mainAppAccess: false,
    });
    const res = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${pending.accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ONBOARDING_REQUIRED");
    expect(res.body.error.homeAccessAllowed).toBe(false);
  });

  it("T025A-H02 home people preview omits blocked peer", async () => {
    const viewer = await createIntegrationUser(app, emailSender, db, "t025a-viewer");
    const blocked = await createIntegrationUser(app, emailSender, db, "t025a-blocked");
    const tag = `t025ablock${Date.now()}`;
    await db.profile.update({
      where: { userId: blocked.userId },
      data: { displayName: tag },
    });

    const beforeBlock = await request(app)
      .get(`/v1/discover/people?q=${encodeURIComponent(tag)}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(beforeBlock.status).toBe(200);
    expect(
      beforeBlock.body.data.people.some((p: { userId: string }) => p.userId === blocked.userId),
    ).toBe(true);

    await request(app)
      .post("/v1/me/blocks")
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .send({ targetUserId: blocked.userId });

    const afterDiscover = await request(app)
      .get(`/v1/discover/people?q=${encodeURIComponent(tag)}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(afterDiscover.status).toBe(200);
    expect(
      afterDiscover.body.data.people.some((p: { userId: string }) => p.userId === blocked.userId),
    ).toBe(false);

    const home = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(home.status).toBe(200);
    const people = home.body.data.people as { userId: string }[];
    expect(people.some((p) => p.userId === blocked.userId)).toBe(false);
  });

  it("T025A-H03 shared home sections truthful; stories deferred; shell badges separable", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "t025a-shell");
    const home = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(home.status).toBe(200);
    const data = home.body.data;
    expect(data.stories.status).toBe("DEFERRED");
    expect(Array.isArray(data.people)).toBe(true);
    expect(Array.isArray(data.activities)).toBe(true);
    expect(Array.isArray(data.myGroups)).toBe(true);
    expect(Array.isArray(data.communityFeedPreview)).toBe(true);
    expect(Array.isArray(data.upcomingGroupActivities)).toBe(true);
    expect(data.featured).toMatchObject({
      groups: expect.any(Array),
      activities: expect.any(Array),
    });
    expect(data).not.toHaveProperty("distanceMiles");
    expect(data).not.toHaveProperty("activePeerCount");
    expect(typeof data.notificationsUnreadCount).toBe("number");

    const messaging = await request(app)
      .get("/v1/me/messaging/summary")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(messaging.status).toBe(200);
    expect(typeof messaging.body.data.displayBadgeCount).toBe("number");
    expect(messaging.body.data).not.toHaveProperty("notificationsUnreadCount");
  });
});
