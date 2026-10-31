import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import pino from "pino";
import { createApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import type { AppEnv } from "../../src/config/env.js";
import {
  createPrismaClient,
  disconnectPrisma,
  type DatabaseClient,
} from "../../src/infrastructure/database/prisma.js";
import { createCapturingEmailSender } from "../helpers/capturing-email-sender.js";
import { createIntegrationUser } from "../helpers/integration-user.js";
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";
import { MeetupInviteService } from "../../src/modules/meetup-invites/meetup-invite.service.js";
import type { NotificationEmitter } from "../../src/modules/notifications/notification-emitter.service.js";
import { meetupInviteNotificationDedupeKey } from "../../src/modules/meetup-invites/meetup-invite-notifications.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";

function futureIso(hoursFromNow = 48): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function createBody(recipientUserId: string) {
  return {
    recipientUserId,
    meetupType: "COFFEE" as const,
    title: "Secret Title 028H",
    scheduledStartsAt: futureIso(),
    scheduleTimeZone: "America/New_York",
    venue: {
      city: "Miami Beach",
      region: "FL",
      label: "Secret Cafe 028H",
      addressLine: "1875 Purdy Ave",
    },
    note: "Private note 028H",
  };
}

const describeH = runIntegration ? describe : describe.skip;

describeH("integration: Task 028H final meetup flow verification", () => {
  let db: DatabaseClient;
  let app: ReturnType<typeof createApp>;
  let env: AppEnv;
  const emailSender = createCapturingEmailSender();

  beforeAll(() => {
    const url = process.env.INTEGRATION_DATABASE_URL?.trim();
    if (!url) {
      throw new Error("INTEGRATION_DATABASE_URL required");
    }
    db = createPrismaClient(url);
    env = loadEnv({
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

  it("028H-E2E: full lifecycle PENDING → ACCEPTED with pagination and counts", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028h-e2e-s", {
      profileVisibility: "EVERYONE",
    });
    const recipient = await createIntegrationUser(app, emailSender, db, "028h-e2e-r", {
      profileVisibility: "EVERYONE",
    });

    const create = await request(app)
      .post("/v1/meetup-invites")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .send(createBody(recipient.userId));
    expect(create.status).toBe(201);
    const inviteId = create.body.data.id as string;

    const page1 = await request(app)
      .get("/v1/meetup-invites?box=incoming&status=pending&limit=1")
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(page1.status).toBe(200);
    expect(page1.body.data.counts.pending).toBe(1);
    expect(page1.body.data.invites[0].venue.label).toBeNull();

    const accept = await request(app)
      .post(`/v1/meetup-invites/${inviteId}/accept`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(accept.status).toBe(200);
    expect(accept.body.data.status).toBe("ACCEPTED");
    expect(accept.body.data.venue.label).toBe("Secret Cafe 028H");

    const pendingAfter = await request(app)
      .get("/v1/meetup-invites?box=incoming&status=pending")
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(pendingAfter.body.data.counts.pending).toBe(0);

    expect(
      await db.userNotification.count({
        where: { dedupeKey: meetupInviteNotificationDedupeKey(inviteId, "received") },
      }),
    ).toBe(1);
    expect(
      await db.userNotification.count({
        where: { dedupeKey: meetupInviteNotificationDedupeKey(inviteId, "accepted") },
      }),
    ).toBe(1);
  });

  it("028H-E2E: EXPIRED via lazy reconcile; terminal conflict 409", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028h-exp-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028h-exp-r");
    const row = await db.personalMeetupInvitation.create({
      data: {
        senderId: sender.userId,
        recipientId: recipient.userId,
        status: "PENDING",
        meetupType: "COFFEE",
        title: "Past",
        scheduledStartsAt: new Date(Date.now() - 60_000),
        scheduleTimeZone: "UTC",
        venueCity: "Miami Beach",
        venueRegion: "FL",
        venueLabel: "Hidden",
      },
    });

    const list = await request(app)
      .get("/v1/meetup-invites?box=incoming&status=expired")
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(list.body.data.invites.some((i: { id: string }) => i.id === row.id)).toBe(true);

    const accept = await request(app)
      .post(`/v1/meetup-invites/${row.id}/accept`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(accept.status).toBe(409);
  });

  it("028H-SEC: blocked user loses invite read; notification body stays generic", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028h-blk-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028h-blk-r");
    const create = await request(app)
      .post("/v1/meetup-invites")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .send(createBody(recipient.userId));
    const inviteId = create.body.data.id as string;

    const note = await db.userNotification.findFirstOrThrow({
      where: { dedupeKey: meetupInviteNotificationDedupeKey(inviteId, "received") },
    });
    expect(`${note.title} ${note.body}`).not.toMatch(/Secret Cafe|Private note|Miami Beach/i);

    await db.userBlock.create({
      data: { blockerId: recipient.userId, blockedId: sender.userId },
    });

    const detail = await request(app)
      .get(`/v1/meetup-invites/${inviteId}`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(detail.status).toBe(404);

    const notifList = await request(app)
      .get("/v1/me/notifications")
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(notifList.status).toBe(200);
    const row = notifList.body.data.notifications.find(
      (n: { notificationId: string }) => n.notificationId === note.id,
    );
    expect(row).toBeTruthy();
    expect(row.actor).toBeNull();
    expect(`${row.title} ${row.body}`).not.toMatch(/Secret Cafe|Private note/i);
  });

  it("028H-ROLLBACK: failed notification emit rolls back invite create", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028h-rb-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028h-rb-r", {
      profileVisibility: "EVERYONE",
    });
    const senderUser = await db.user.findUniqueOrThrow({ where: { id: sender.userId } });
    const failingEmitter = {
      emitInTransaction: vi.fn().mockRejectedValue(new Error("simulated notification failure")),
      emit: vi.fn(),
    } as unknown as NotificationEmitter;
    const kyc = {
      isProduction: env.isProduction,
      kycProviderEnabled: env.KYC_PROVIDER_ENABLED,
      kycManualReviewEnabled: false,
    };
    const service = new MeetupInviteService(db, kyc, failingEmitter);

    await expect(
      service.create(senderUser, createBody(recipient.userId), undefined),
    ).rejects.toThrow(/simulated notification failure/);

    const invites = await db.personalMeetupInvitation.findMany({
      where: { senderId: sender.userId, recipientId: recipient.userId },
    });
    expect(invites).toHaveLength(0);
    expect(await db.userNotification.count()).toBe(0);
  });

  it("028H-REG: discover profile, follow, wave, message-request, settings capability DEFERRED", async () => {
    const a = await createIntegrationUser(app, emailSender, db, "028h-disc-a", {
      profileVisibility: "EVERYONE",
    });
    const b = await createIntegrationUser(app, emailSender, db, "028h-disc-b", {
      profileVisibility: "EVERYONE",
    });

    const profile = await request(app)
      .get(`/v1/users/${b.userId}`)
      .set("Authorization", `Bearer ${a.accessToken}`);
    expect(profile.status).toBe(200);

    const discover = await request(app)
      .get("/v1/discover/people?limit=5")
      .set("Authorization", `Bearer ${a.accessToken}`);
    expect(discover.status).toBe(200);

    expect(
      (
        await request(app)
          .post(`/v1/users/${b.userId}/follow`)
          .set("Authorization", `Bearer ${a.accessToken}`)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/v1/users/${b.userId}/wave`)
          .set("Authorization", `Bearer ${a.accessToken}`)
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post("/v1/me/message-requests")
          .set("Authorization", `Bearer ${a.accessToken}`)
          .send({ targetUserId: b.userId })
      ).status,
    ).toBe(201);

    const settings = await request(app)
      .get("/v1/me/settings/overview")
      .set("Authorization", `Bearer ${a.accessToken}`);
    expect(settings.status).toBe(200);
    expect(settings.body.data.capabilities.meetupInvites).toBe("DEFERRED");
  });

  it("028H-REG: personal meetup create does not create Activity participation or DM", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028h-iso-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028h-iso-r", {
      profileVisibility: "EVERYONE",
    });
    const beforeParticipation = await db.activityParticipation.count();
    const beforeConversations = await db.directConversation.count();

    await request(app)
      .post("/v1/meetup-invites")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .send(createBody(recipient.userId))
      .expect(201);

    expect(await db.activityParticipation.count()).toBe(beforeParticipation);
    expect(await db.directConversation.count()).toBe(beforeConversations);
  });
});
