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
import { meetupInviteNotificationDedupeKey } from "../../src/modules/meetup-invites/meetup-invite-notifications.js";
import { MockFcmSender } from "../../src/modules/push-delivery/fcm-sender.js";
import { processPushOutboxBatch } from "../../src/modules/push-delivery/push-outbox.worker.js";
import { buildPrivacySafePushPayload } from "../../src/modules/push-delivery/push-payload.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";

function futureIso(hoursFromNow = 48): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function createBody(recipientUserId: string) {
  return {
    recipientUserId,
    meetupType: "COFFEE",
    title: "Coffee Meetup",
    scheduledStartsAt: futureIso(),
    scheduleTimeZone: "America/New_York",
    venue: {
      city: "Miami Beach",
      region: "FL",
      label: "Secret Cafe",
      addressLine: "1875 Purdy Ave",
    },
    note: "Hello private note",
  };
}

const describeMeetup = runIntegration ? describe : describe.skip;

describeMeetup("integration: meetup invite notifications 028G", () => {
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
    await db.$disconnect();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    clearRateLimits();
    await db.pushNotificationOutbox.deleteMany({});
    await db.userNotification.deleteMany({});
    await db.personalMeetupInvitation.deleteMany({});
    await db.userBlock.deleteMany({});
  });

  async function createInvite(senderToken: string, recipientId: string) {
    const res = await request(app)
      .post("/v1/meetup-invites")
      .set("Authorization", `Bearer ${senderToken}`)
      .send(createBody(recipientId));
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  it("emits RECEIVED on create with dedupe and privacy-safe fields", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028g-s1");
    const recipient = await createIntegrationUser(app, emailSender, db, "028g-r1", {
      profileVisibility: "EVERYONE",
    });
    const inviteId = await createInvite(sender.accessToken, recipient.userId);

    const rows = await db.userNotification.findMany({
      where: { recipientId: recipient.userId, type: "MEETUP_INVITATION_RECEIVED" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sourceId).toBe(inviteId);
    expect(rows[0]?.dedupeKey).toBe(meetupInviteNotificationDedupeKey(inviteId, "received"));
    expect(rows[0]?.actorUserId).toBeNull();
    const blob = `${rows[0]?.title} ${rows[0]?.body}`;
    expect(blob).not.toMatch(/Secret Cafe|Miami Beach|Coffee Meetup|Hello private/i);

    const list = await request(app)
      .get("/v1/me/notifications")
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.notifications.some((n: { sourceId: string }) => n.sourceId === inviteId)).toBe(
      true,
    );
  });

  it("does not duplicate RECEIVED on create idempotency replay", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028g-idem-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028g-idem-r");
    const key = `idem-${randomUUID()}`;
    const body = createBody(recipient.userId);
    const first = await request(app)
      .post("/v1/meetup-invites")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .set("Idempotency-Key", key)
      .send(body);
    expect(first.status).toBe(201);
    const firstInviteId = first.body.data.id as string;
    const replay = await request(app)
      .post("/v1/meetup-invites")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .set("Idempotency-Key", key)
      .send(body);
    expect(replay.status).toBe(200);
    const count = await db.userNotification.count({
      where: {
        type: "MEETUP_INVITATION_RECEIVED",
        dedupeKey: meetupInviteNotificationDedupeKey(firstInviteId, "received"),
      },
    });
    expect(count).toBe(1);
  });

  it("emits ACCEPTED/DECLINED/WITHDRAWN once and idempotent accept skips second notify", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028g-mut-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028g-mut-r");
    const inviteId = await createInvite(sender.accessToken, recipient.userId);

    await request(app)
      .post(`/v1/meetup-invites/${inviteId}/accept`)
      .set("Authorization", `Bearer ${recipient.accessToken}`)
      .expect(200);
    await request(app)
      .post(`/v1/meetup-invites/${inviteId}/accept`)
      .set("Authorization", `Bearer ${recipient.accessToken}`)
      .expect(200);

    const accepted = await db.userNotification.count({
      where: { dedupeKey: meetupInviteNotificationDedupeKey(inviteId, "accepted") },
    });
    expect(accepted).toBe(1);

    await db.userNotification.deleteMany({});
    await db.personalMeetupInvitation.deleteMany({});
    const invite2 = await createInvite(sender.accessToken, recipient.userId);
    await request(app)
      .post(`/v1/meetup-invites/${invite2}/decline`)
      .set("Authorization", `Bearer ${recipient.accessToken}`)
      .expect(200);
    expect(
      await db.userNotification.count({
        where: { dedupeKey: meetupInviteNotificationDedupeKey(invite2, "declined") },
      }),
    ).toBe(1);

    await db.userNotification.deleteMany({});
    await db.personalMeetupInvitation.deleteMany({});
    const invite3 = await createInvite(sender.accessToken, recipient.userId);
    await request(app)
      .post(`/v1/meetup-invites/${invite3}/withdraw`)
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .expect(200);
    expect(
      await db.userNotification.count({
        where: { dedupeKey: meetupInviteNotificationDedupeKey(invite3, "withdrawn") },
      }),
    ).toBe(1);
  });

  it("does not emit ACCEPTED when accept fails due to recipient KYC revoked", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028g-kyc-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028g-kyc-r");
    const inviteId = await createInvite(sender.accessToken, recipient.userId);

    await db.user.update({
      where: { id: recipient.userId },
      data: { identityVerificationRevokedAt: new Date() },
    });

    const accept = await request(app)
      .post(`/v1/meetup-invites/${inviteId}/accept`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(accept.status).toBe(403);

    expect(
      await db.userNotification.count({
        where: { dedupeKey: meetupInviteNotificationDedupeKey(inviteId, "accepted") },
      }),
    ).toBe(0);
  });

  it("does not emit ACCEPTED when sender loses activation before accept", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028g-kyc-s2");
    const recipient = await createIntegrationUser(app, emailSender, db, "028g-kyc-r2");
    const inviteId = await createInvite(sender.accessToken, recipient.userId);

    await db.user.update({
      where: { id: sender.userId },
      data: { identityVerificationRevokedAt: new Date() },
    });

    const accept = await request(app)
      .post(`/v1/meetup-invites/${inviteId}/accept`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(accept.status).toBe(403);

    expect(
      await db.userNotification.count({
        where: { dedupeKey: meetupInviteNotificationDedupeKey(inviteId, "accepted") },
      }),
    ).toBe(0);
  });

  it("blocked participant cannot mutate and does not emit transition notifications", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028g-blk-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028g-blk-r");
    const inviteId = await createInvite(sender.accessToken, recipient.userId);

    await db.userBlock.create({
      data: { blockerId: recipient.userId, blockedId: sender.userId },
    });

    const before = await db.userNotification.count();
    const accept = await request(app)
      .post(`/v1/meetup-invites/${inviteId}/accept`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(accept.status).toBe(404);
    const after = await db.userNotification.count();
    expect(after).toBe(before);
  });

  it("notification read is independent of invite accept", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028g-read-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028g-read-r");
    const inviteId = await createInvite(sender.accessToken, recipient.userId);
    const note = await db.userNotification.findFirstOrThrow({
      where: { dedupeKey: meetupInviteNotificationDedupeKey(inviteId, "received") },
    });

    await request(app)
      .post(`/v1/me/notifications/${note.id}/read`)
      .set("Authorization", `Bearer ${recipient.accessToken}`)
      .expect(200);

    const invite = await db.personalMeetupInvitation.findUniqueOrThrow({ where: { id: inviteId } });
    expect(invite.status).toBe("PENDING");
  });

  it("meetupInvitesEnabled=false skips push send while in-app row exists", async () => {
    const envPush = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: process.env.INTEGRATION_DATABASE_URL!,
      CORS_ORIGINS: "http://localhost:3000",
      JWT_ACCESS_SECRET: "test-jwt-access-secret-min-32-chars!!",
      PROFILE_UPLOAD_DIR: ".data/test-avatars",
      ACTIVITY_UPLOAD_DIR: ".data/test-activity-media",
      PUSH_ENABLED: "true",
    });
    const sender = await createIntegrationUser(app, emailSender, db, "028g-push-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028g-push-r");
    await request(app)
      .patch("/v1/me/notification-preferences")
      .set("Authorization", `Bearer ${recipient.accessToken}`)
      .send({ meetupInvitesEnabled: false });
    await request(app)
      .post("/v1/me/device-tokens")
      .set("Authorization", `Bearer ${recipient.accessToken}`)
      .send({
        platform: "android",
        registrationToken: "fcm-meetup-token-01234567890123456789012",
        deviceBindingId: `028g-${randomUUID()}`,
      });

    await createInvite(sender.accessToken, recipient.userId);
    const note = await db.userNotification.findFirstOrThrow({
      where: { recipientId: recipient.userId, type: "MEETUP_INVITATION_RECEIVED" },
    });
    const outbox = await db.pushNotificationOutbox.findUniqueOrThrow({
      where: { userNotificationId: note.id },
    });

    const mock = new MockFcmSender();
    await processPushOutboxBatch({
      db,
      env: envPush,
      fcmSender: mock,
      logger: pino({ level: "silent" }),
      workerId: "test-028g",
    });

    const refreshed = await db.pushNotificationOutbox.findUniqueOrThrow({ where: { id: outbox.id } });
    expect(refreshed.status).toBe("SKIPPED");
    expect(mock.sent).toHaveLength(0);

    const push = buildPrivacySafePushPayload({
      notificationId: note.id,
      type: "MEETUP_INVITATION_RECEIVED",
      sourceId: note.sourceId,
    });
    expect(JSON.stringify(push.data)).not.toMatch(/Secret|Miami|Coffee/i);
  });

  it("accepted invite venue on detail only; social follow wave message-request regression", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028g-soc-s", {
      profileVisibility: "EVERYONE",
    });
    const recipient = await createIntegrationUser(app, emailSender, db, "028g-soc-r", {
      profileVisibility: "EVERYONE",
    });
    const inviteId = await createInvite(sender.accessToken, recipient.userId);
    await request(app)
      .post(`/v1/meetup-invites/${inviteId}/accept`)
      .set("Authorization", `Bearer ${recipient.accessToken}`)
      .expect(200);

    const detail = await request(app)
      .get(`/v1/meetup-invites/${inviteId}`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(detail.body.data.venue.label).toBe("Secret Cafe");

    const follow = await request(app)
      .post(`/v1/users/${recipient.userId}/follow`)
      .set("Authorization", `Bearer ${sender.accessToken}`);
    expect(follow.status).toBe(200);

    const wave = await request(app)
      .post(`/v1/users/${recipient.userId}/wave`)
      .set("Authorization", `Bearer ${sender.accessToken}`);
    expect(wave.status).toBe(200);

    const msgReq = await request(app)
      .post("/v1/me/message-requests")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .send({ targetUserId: recipient.userId });
    expect(msgReq.status).toBe(201);
  });
});
