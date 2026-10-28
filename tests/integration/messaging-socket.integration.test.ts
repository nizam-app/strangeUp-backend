import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import pino from "pino";
import { loadEnv } from "../../src/config/env.js";
import {
  createPrismaClient,
  disconnectPrisma,
  type DatabaseClient,
} from "../../src/infrastructure/database/prisma.js";
import { createCapturingEmailSender } from "../helpers/capturing-email-sender.js";
import { createIntegrationUser } from "../helpers/integration-user.js";
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";
import {
  MESSAGING_SOCKET_EVENTS,
  startMessagingSocketHarness,
  waitForSocketEvent,
} from "../helpers/messaging-socket-harness.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";

async function activatedUser(
  harness: Awaited<ReturnType<typeof startMessagingSocketHarness>>,
  emailSender: ReturnType<typeof createCapturingEmailSender>,
  db: DatabaseClient,
  prefix: string,
  options?: { mainAppAccess?: boolean },
) {
  const user = await createIntegrationUser(harness.app, emailSender, db, prefix, {
    profileVisibility: "EVERYONE",
    mainAppAccess: options?.mainAppAccess,
  });
  return { accessToken: user.accessToken, userId: user.userId };
}

const describeSocket = runIntegration ? describe : describe.skip;

describeSocket("integration: messaging Socket.IO (Task 023B)", () => {
  let db: DatabaseClient;
  let harness: Awaited<ReturnType<typeof startMessagingSocketHarness>>;
  const emailSender = createCapturingEmailSender();

  beforeAll(async () => {
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
      SOCKET_IO_ENABLED: "true",
      SOCKET_IO_ACCOUNT_RECHECK_INTERVAL_MS: "2000",
    });
    harness = await startMessagingSocketHarness({
      env,
      logger: pino({ level: "silent" }),
      db,
      emailSender,
    });
  });

  afterAll(async () => {
    await harness.close();
    await disconnectPrisma();
  });

  beforeEach(() => {
    clearRateLimits();
    emailSender.clear();
  });

  it("T023B-P01 authenticated socket connects; REST DM broadcast received once", async () => {
    const a = await activatedUser(harness, emailSender, db, "t023b-a");
    const b = await activatedUser(harness, emailSender, db, "t023b-b");

    const created = await request(harness.app)
      .post("/v1/me/message-requests")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ targetUserId: b.userId });
    const accepted = await request(harness.app)
      .post(`/v1/me/message-requests/${created.body.data.requestId}/accept`)
      .set("Authorization", `Bearer ${b.accessToken}`);
    const conversationId = accepted.body.data.conversationId as string;

    const socket = harness.connectClient(b.accessToken);
    await waitForSocketEvent(socket, MESSAGING_SOCKET_EVENTS.connected);
    socket.emit(MESSAGING_SOCKET_EVENTS.subscribeDm, { conversationId });
    await waitForSocketEvent(socket, MESSAGING_SOCKET_EVENTS.subscribed);

    const clientMessageId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const events: unknown[] = [];
    socket.on(MESSAGING_SOCKET_EVENTS.dmMessage, (payload) => events.push(payload));

    const first = await request(harness.app)
      .post(`/v1/me/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ body: "realtime hello", clientMessageId });
    const second = await request(harness.app)
      .post(`/v1/me/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ body: "realtime hello", clientMessageId });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    await new Promise((r) => setTimeout(r, 500));
    expect(events).toHaveLength(1);
    expect((events[0] as { message: { body: string } }).message.body).toBe("realtime hello");
    socket.disconnect();
  });

  it("T023B-N01 pending applicant and missing token cannot connect", async () => {
    const pending = await activatedUser(harness, emailSender, db, "t023b-pend", {
      mainAppAccess: false,
    });
    const pendingSocket = harness.connectClient(pending.accessToken);
    await expect(
      new Promise<void>((resolve, reject) => {
        pendingSocket.on("connect", () => reject(new Error("pending user should not connect")));
        pendingSocket.on("connect_error", () => resolve());
        setTimeout(() => reject(new Error("timeout waiting for connect_error")), 5_000);
      }),
    ).resolves.toBeUndefined();
    pendingSocket.disconnect();

    const bad = harness.connectClient("not-a-valid-token");
    await expect(
      new Promise<void>((resolve, reject) => {
        bad.on("connect", () => reject(new Error("invalid token should not connect")));
        bad.on("connect_error", () => resolve());
        setTimeout(() => reject(new Error("timeout waiting for connect_error")), 5_000);
      }),
    ).resolves.toBeUndefined();
    bad.disconnect();
  });

  it("T023B-N02 cannot subscribe to another user's conversation", async () => {
    const a = await activatedUser(harness, emailSender, db, "t023b-iso-a");
    const b = await activatedUser(harness, emailSender, db, "t023b-iso-b");
    const c = await activatedUser(harness, emailSender, db, "t023b-iso-c");

    const req = await request(harness.app)
      .post("/v1/me/message-requests")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ targetUserId: b.userId });
    const accepted = await request(harness.app)
      .post(`/v1/me/message-requests/${req.body.data.requestId}/accept`)
      .set("Authorization", `Bearer ${b.accessToken}`);
    const conversationId = accepted.body.data.conversationId as string;

    const socket = harness.connectClient(c.accessToken);
    await waitForSocketEvent(socket, MESSAGING_SOCKET_EVENTS.connected);
    socket.emit(MESSAGING_SOCKET_EVENTS.subscribeDm, { conversationId });
    const err = await waitForSocketEvent<{ code: string }>(socket, MESSAGING_SOCKET_EVENTS.error);
    expect(err.code).toBe("NOT_FOUND");
    socket.disconnect();
  });

  it("T023B-N03 revoked session disconnects on protected subscribe", async () => {
    const a = await activatedUser(harness, emailSender, db, "t023b-rev-a");
    const b = await activatedUser(harness, emailSender, db, "t023b-rev-b");
    const req = await request(harness.app)
      .post("/v1/me/message-requests")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ targetUserId: b.userId });
    const accepted = await request(harness.app)
      .post(`/v1/me/message-requests/${req.body.data.requestId}/accept`)
      .set("Authorization", `Bearer ${b.accessToken}`);
    const conversationId = accepted.body.data.conversationId as string;

    const socket = harness.connectClient(b.accessToken);
    await waitForSocketEvent(socket, MESSAGING_SOCKET_EVENTS.connected);

    await request(harness.app)
      .post("/v1/auth/logout")
      .set("Authorization", `Bearer ${b.accessToken}`);

    const postLogout = await request(harness.app)
      .post(`/v1/me/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ body: "after b logout" });
    expect(postLogout.status).toBe(201);

    const leaked: unknown[] = [];
    socket.on(MESSAGING_SOCKET_EVENTS.dmMessage, (payload) => leaked.push(payload));
    await new Promise((r) => setTimeout(r, 800));
    expect(leaked).toHaveLength(0);
    socket.disconnect();
  });

  it("T023B-S01 passive leak: blocked user receives no dm_message while still connected", async () => {
    const a = await activatedUser(harness, emailSender, db, "t023b-blka");
    const b = await activatedUser(harness, emailSender, db, "t023b-blkb");
    const req = await request(harness.app)
      .post("/v1/me/message-requests")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ targetUserId: b.userId });
    const accepted = await request(harness.app)
      .post(`/v1/me/message-requests/${req.body.data.requestId}/accept`)
      .set("Authorization", `Bearer ${b.accessToken}`);
    const conversationId = accepted.body.data.conversationId as string;

    const socket = harness.connectClient(b.accessToken);
    await waitForSocketEvent(socket, MESSAGING_SOCKET_EVENTS.connected);
    socket.emit(MESSAGING_SOCKET_EVENTS.subscribeDm, { conversationId });
    await waitForSocketEvent(socket, MESSAGING_SOCKET_EVENTS.subscribed);

    await request(harness.app)
      .post("/v1/me/blocks")
      .set("Authorization", `Bearer ${b.accessToken}`)
      .send({ targetUserId: a.userId });

    const received: unknown[] = [];
    socket.on(MESSAGING_SOCKET_EVENTS.dmMessage, (payload) => received.push(payload));

    await request(harness.app)
      .post(`/v1/me/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ body: "should not leak to blocked viewer" });

    await new Promise((r) => setTimeout(r, 800));
    expect(received).toHaveLength(0);
    socket.disconnect();
  });

  it("T023B-S02 passive leak: ex-member receives no group_message while still connected", async () => {
    const owner = await activatedUser(harness, emailSender, db, "t023b-grpo");
    const member = await activatedUser(harness, emailSender, db, "t023b-grpm");
    const created = await request(harness.app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Socket Leave Club", category: "social", privacy: "PUBLIC" });
    const groupId = created.body.data.groupId as string;
    await request(harness.app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);

    const socket = harness.connectClient(member.accessToken);
    await waitForSocketEvent(socket, MESSAGING_SOCKET_EVENTS.connected);
    socket.emit(MESSAGING_SOCKET_EVENTS.subscribeGroup, { groupId });
    await waitForSocketEvent(socket, MESSAGING_SOCKET_EVENTS.subscribed);

    await request(harness.app)
      .delete(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);

    const received: unknown[] = [];
    socket.on(MESSAGING_SOCKET_EVENTS.groupMessage, (payload) => received.push(payload));

    await request(harness.app)
      .post(`/v1/groups/${groupId}/chat/messages`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ body: "after member left" });

    await new Promise((r) => setTimeout(r, 800));
    expect(received).toHaveLength(0);
    socket.disconnect();
  });

  it("T023D-S01 suspended account disconnects on periodic eligibility recheck", async () => {
    const user = await activatedUser(harness, emailSender, db, "t023d-susp");
    const socket = harness.connectClient(user.accessToken);
    await waitForSocketEvent(socket, MESSAGING_SOCKET_EVENTS.connected);

    await db.user.update({
      where: { id: user.userId },
      data: { accountStatus: "SUSPENDED", suspendedAt: new Date() },
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("socket did not disconnect after suspension"));
      }, 8_000);
      socket.on("disconnect", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    socket.disconnect();
  });

  it("T023D-S02 suspended user receives no messaging summary events", async () => {
    const a = await activatedUser(harness, emailSender, db, "t023d-sum-a");
    const b = await activatedUser(harness, emailSender, db, "t023d-sum-b");
    const req = await request(harness.app)
      .post("/v1/me/message-requests")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ targetUserId: b.userId });
    const accepted = await request(harness.app)
      .post(`/v1/me/message-requests/${req.body.data.requestId}/accept`)
      .set("Authorization", `Bearer ${b.accessToken}`);
    const conversationId = accepted.body.data.conversationId as string;

    const socket = harness.connectClient(b.accessToken);
    await waitForSocketEvent(socket, MESSAGING_SOCKET_EVENTS.connected);
    socket.emit(MESSAGING_SOCKET_EVENTS.subscribeDm, { conversationId });
    await waitForSocketEvent(socket, MESSAGING_SOCKET_EVENTS.subscribed);

    await db.user.update({
      where: { id: b.userId },
      data: { accountStatus: "SUSPENDED", suspendedAt: new Date() },
    });

    const summaries: unknown[] = [];
    socket.on(MESSAGING_SOCKET_EVENTS.summary, (payload) => summaries.push(payload));

    await request(harness.app)
      .post(`/v1/me/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ body: "after b suspended" });

    await new Promise((r) => setTimeout(r, 2_500));
    expect(summaries).toHaveLength(0);
    socket.disconnect();
  });
});
