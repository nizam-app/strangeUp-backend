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

async function verifiedUser(
  app: ReturnType<typeof createApp>,
  emailSender: ReturnType<typeof createCapturingEmailSender>,
  db: DatabaseClient,
  prefix: string,
  options?: {
    visibility?: "EVERYONE" | "VERIFIED_USERS_ONLY";
    mainAppAccess?: boolean;
  },
): Promise<{ accessToken: string; userId: string }> {
  const user = await createIntegrationUser(app, emailSender, db, prefix, {
    profileVisibility: options?.visibility,
    mainAppAccess: options?.mainAppAccess,
  });
  return { accessToken: user.accessToken, userId: user.userId };
}

const describeSocial = runIntegration ? describe : describe.skip;

describeSocial("integration: social connections (Task 011)", () => {
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

  it("T011-P01 follow/unfollow is idempotent and counts are database-backed", async () => {
    const a = await verifiedUser(app, emailSender, db, "t011-fa", { visibility: "EVERYONE" });
    const b = await verifiedUser(app, emailSender, db, "t011-fb", { visibility: "EVERYONE" });

    const follow = await request(app)
      .post(`/v1/users/${b.userId}/follow`)
      .set("Authorization", `Bearer ${a.accessToken}`);
    const followAgain = await request(app)
      .post(`/v1/users/${b.userId}/follow`)
      .set("Authorization", `Bearer ${a.accessToken}`);
    expect(follow.status).toBe(200);
    expect(followAgain.status).toBe(200);
    expect(followAgain.body.data.following).toBe(true);

    const profile = await request(app)
      .get(`/v1/users/${b.userId}`)
      .set("Authorization", `Bearer ${a.accessToken}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.followerCount).toBe(1);
    expect(profile.body.data.viewerFollows).toBe(true);
    expect(profile.body.data).not.toHaveProperty("email");

    const selfFollow = await request(app)
      .post(`/v1/users/${a.userId}/follow`)
      .set("Authorization", `Bearer ${a.accessToken}`);
    expect(selfFollow.status).toBe(400);

    const unfollow = await request(app)
      .delete(`/v1/users/${b.userId}/follow`)
      .set("Authorization", `Bearer ${a.accessToken}`);
    expect(unfollow.body.data.following).toBe(false);
  });

  it("T011-N01 pending viewer denied main app; blocked targets stay 404", async () => {
    const pendingViewer = await verifiedUser(app, emailSender, db, "t011-hid-v", {
      mainAppAccess: false,
    });
    const hidden = await verifiedUser(app, emailSender, db, "t011-hid-t", {
      visibility: "VERIFIED_USERS_ONLY",
    });
    const blockedTarget = await verifiedUser(app, emailSender, db, "t011-blk-t", {
      visibility: "EVERYONE",
    });

    const deniedFollow = await request(app)
      .post(`/v1/users/${hidden.userId}/follow`)
      .set("Authorization", `Bearer ${pendingViewer.accessToken}`);
    expect(deniedFollow.status).toBe(403);
    expect(deniedFollow.body.error.code).toBe("ONBOARDING_REQUIRED");

    const viewer = await verifiedUser(app, emailSender, db, "t011-hid-v2");
    const hiddenFollow = await request(app)
      .post(`/v1/users/${hidden.userId}/follow`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(hiddenFollow.status).toBe(200);

    await request(app)
      .post("/v1/me/blocks")
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .send({ targetUserId: blockedTarget.userId });
    const blockedFollow = await request(app)
      .post(`/v1/users/${blockedTarget.userId}/follow`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(blockedFollow.status).toBe(404);
  });

  it("T011-P02 wave is idempotent and does not create a conversation", async () => {
    const a = await verifiedUser(app, emailSender, db, "t011-wa", { visibility: "EVERYONE" });
    const b = await verifiedUser(app, emailSender, db, "t011-wb", { visibility: "EVERYONE" });
    const wave = await request(app)
      .post(`/v1/users/${b.userId}/wave`)
      .set("Authorization", `Bearer ${a.accessToken}`);
    const waveAgain = await request(app)
      .post(`/v1/users/${b.userId}/wave`)
      .set("Authorization", `Bearer ${a.accessToken}`);
    expect(wave.status).toBe(200);
    expect(waveAgain.status).toBe(200);

    const inbox = await request(app)
      .get("/v1/me/waves")
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(inbox.status).toBe(200);
    expect(inbox.body.data.waves).toHaveLength(1);

    const chats = await request(app)
      .get("/v1/me/conversations")
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(chats.body.data.conversations).toEqual([]);
  });

  it("T011-P03 message request accept creates one conversation; decline blocks retry", async () => {
    const a = await verifiedUser(app, emailSender, db, "t011-ra", { visibility: "EVERYONE" });
    const b = await verifiedUser(app, emailSender, db, "t011-rb", { visibility: "EVERYONE" });
    const stranger = await verifiedUser(app, emailSender, db, "t011-rs", {
      visibility: "EVERYONE",
    });

    const created = await request(app)
      .post("/v1/me/message-requests")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ targetUserId: b.userId });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe("PENDING");
    expect(created.body.data).not.toHaveProperty("body");

    const requestId = created.body.data.requestId as string;
    const strangerAccept = await request(app)
      .post(`/v1/me/message-requests/${requestId}/accept`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(strangerAccept.status).toBe(404);

    const [acceptOne, acceptTwo] = await Promise.all([
      request(app)
        .post(`/v1/me/message-requests/${requestId}/accept`)
        .set("Authorization", `Bearer ${b.accessToken}`),
      request(app)
        .post(`/v1/me/message-requests/${requestId}/accept`)
        .set("Authorization", `Bearer ${b.accessToken}`),
    ]);
    expect([acceptOne.status, acceptTwo.status].every((s) => s === 200)).toBe(true);
    expect(acceptOne.body.data.conversationId).toBe(acceptTwo.body.data.conversationId);

    const c = await verifiedUser(app, emailSender, db, "t011-rc", { visibility: "EVERYONE" });
    const declined = await request(app)
      .post("/v1/me/message-requests")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ targetUserId: c.userId });
    await request(app)
      .post(`/v1/me/message-requests/${declined.body.data.requestId}/decline`)
      .set("Authorization", `Bearer ${c.accessToken}`);
    const retry = await request(app)
      .post("/v1/me/message-requests")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ targetUserId: c.userId });
    expect(retry.status).toBe(409);
  });

  it("T011-P04 messages, unread, read watermark, block hide, and no E2EE fields", async () => {
    const a = await verifiedUser(app, emailSender, db, "t011-ca", { visibility: "EVERYONE" });
    const b = await verifiedUser(app, emailSender, db, "t011-cb", { visibility: "EVERYONE" });
    const created = await request(app)
      .post("/v1/me/message-requests")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ targetUserId: b.userId });
    const accepted = await request(app)
      .post(`/v1/me/message-requests/${created.body.data.requestId}/accept`)
      .set("Authorization", `Bearer ${b.accessToken}`);
    const conversationId = accepted.body.data.conversationId as string;

    const first = await request(app)
      .post(`/v1/me/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ body: "hello", clientMessageId: "11111111-1111-4111-8111-111111111111" });
    const retry = await request(app)
      .post(`/v1/me/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ body: "hello", clientMessageId: "11111111-1111-4111-8111-111111111111" });
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.body.data.messageId).toBe(first.body.data.messageId);
    expect(first.body.data).not.toHaveProperty("delivered");
    expect(first.body.data).not.toHaveProperty("encrypted");

    const list = await request(app)
      .get("/v1/me/conversations")
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(list.body.data.conversations[0].unreadCount).toBe(1);

    const read = await request(app)
      .post(`/v1/me/conversations/${conversationId}/read`)
      .set("Authorization", `Bearer ${b.accessToken}`)
      .send({});
    expect(read.body.data.unreadCount).toBe(0);

    await request(app)
      .post("/v1/me/blocks")
      .set("Authorization", `Bearer ${b.accessToken}`)
      .send({ targetUserId: a.userId });
    const hidden = await request(app)
      .get(`/v1/me/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(hidden.status).toBe(404);
    const blockedSend = await request(app)
      .post(`/v1/me/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ body: "still there?" });
    expect(blockedSend.status).toBe(404);
  });
});
