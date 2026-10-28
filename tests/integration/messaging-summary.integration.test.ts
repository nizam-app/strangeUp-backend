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
  options?: { mainAppAccess?: boolean },
): Promise<{ accessToken: string; userId: string }> {
  const user = await createIntegrationUser(app, emailSender, db, prefix, {
    profileVisibility: "EVERYONE",
    mainAppAccess: options?.mainAppAccess,
  });
  return { accessToken: user.accessToken, userId: user.userId };
}

const describeMessagingSummary = runIntegration ? describe : describe.skip;

describeMessagingSummary("integration: messaging summary (Task 023A)", () => {
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

  it("T023A-P01 summary reflects DM, group, and pending request counts; read clears DM unread", async () => {
    const a = await verifiedUser(app, emailSender, db, "t023a-a");
    const b = await verifiedUser(app, emailSender, db, "t023a-b");
    const requester = await verifiedUser(app, emailSender, db, "t023a-req");

    const pendingReq = await request(app)
      .post("/v1/me/message-requests")
      .set("Authorization", `Bearer ${requester.accessToken}`)
      .send({ targetUserId: b.userId });
    expect(pendingReq.status).toBe(201);

    const created = await request(app)
      .post("/v1/me/message-requests")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ targetUserId: b.userId });
    const accepted = await request(app)
      .post(`/v1/me/message-requests/${created.body.data.requestId}/accept`)
      .set("Authorization", `Bearer ${b.accessToken}`);
    const conversationId = accepted.body.data.conversationId as string;

    await request(app)
      .post(`/v1/me/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ body: "dm one" });
    await request(app)
      .post(`/v1/me/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ body: "dm two" });

    const groupRes = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ name: "Summary Club", category: "social", privacy: "PUBLIC" });
    const groupId = groupRes.body.data.groupId as string;
    await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${b.accessToken}`);
    await request(app)
      .post(`/v1/groups/${groupId}/chat/messages`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ body: "group hello" });

    const summary = await request(app)
      .get("/v1/me/messaging/summary")
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.data).toMatchObject({
      directUnread: 2,
      groupUnread: 1,
      messageRequestsPending: 1,
      totalUnreadMessages: 3,
      displayBadgeCount: 3,
      directConversationsWithUnread: 1,
      groupChatsWithUnread: 1,
    });

    await request(app)
      .post(`/v1/me/conversations/${conversationId}/read`)
      .set("Authorization", `Bearer ${b.accessToken}`)
      .send({});

    const afterRead = await request(app)
      .get("/v1/me/messaging/summary")
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(afterRead.body.data.directUnread).toBe(0);
    expect(afterRead.body.data.totalUnreadMessages).toBe(1);
    expect(afterRead.body.data.messageRequestsPending).toBe(1);
  });

  it("T023A-N01 pending applicant denied; block excludes DM and request counts", async () => {
    const pending = await verifiedUser(app, emailSender, db, "t023a-pend", {
      mainAppAccess: false,
    });
    const denied = await request(app)
      .get("/v1/me/messaging/summary")
      .set("Authorization", `Bearer ${pending.accessToken}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("ONBOARDING_REQUIRED");

    const a = await verifiedUser(app, emailSender, db, "t023a-blk-a");
    const b = await verifiedUser(app, emailSender, db, "t023a-blk-b");
    const c = await verifiedUser(app, emailSender, db, "t023a-blk-c");

    const pendingFromC = await request(app)
      .post("/v1/me/message-requests")
      .set("Authorization", `Bearer ${c.accessToken}`)
      .send({ targetUserId: b.userId });
    expect(pendingFromC.status).toBe(201);

    const reqFromA = await request(app)
      .post("/v1/me/message-requests")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ targetUserId: b.userId });
    const accepted = await request(app)
      .post(`/v1/me/message-requests/${reqFromA.body.data.requestId}/accept`)
      .set("Authorization", `Bearer ${b.accessToken}`);
    const conversationId = accepted.body.data.conversationId as string;

    await request(app)
      .post(`/v1/me/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ body: "before block" });

    const beforeBlock = await request(app)
      .get("/v1/me/messaging/summary")
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(beforeBlock.body.data.directUnread).toBe(1);
    expect(beforeBlock.body.data.messageRequestsPending).toBe(1);

    await request(app)
      .post("/v1/me/blocks")
      .set("Authorization", `Bearer ${b.accessToken}`)
      .send({ targetUserId: a.userId });

    const summary = await request(app)
      .get("/v1/me/messaging/summary")
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(summary.body.data.directUnread).toBe(0);
    expect(summary.body.data.messageRequestsPending).toBe(1);

    await request(app)
      .post("/v1/me/blocks")
      .set("Authorization", `Bearer ${b.accessToken}`)
      .send({ targetUserId: c.userId });

    const afterBlockC = await request(app)
      .get("/v1/me/messaging/summary")
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(afterBlockC.body.data.messageRequestsPending).toBe(0);
  });

  it("T023A-P02 leaving a group removes its unread from summary", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t023a-grp-o");
    const member = await verifiedUser(app, emailSender, db, "t023a-grp-m");
    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Leave Club", category: "social", privacy: "PUBLIC" });
    const groupId = created.body.data.groupId as string;
    await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    await request(app)
      .post(`/v1/groups/${groupId}/chat/messages`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ body: "ping" });

    const beforeLeave = await request(app)
      .get("/v1/me/messaging/summary")
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(beforeLeave.body.data.groupUnread).toBe(1);

    await request(app)
      .delete(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);

    const afterLeave = await request(app)
      .get("/v1/me/messaging/summary")
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(afterLeave.body.data.groupUnread).toBe(0);
  });
});
