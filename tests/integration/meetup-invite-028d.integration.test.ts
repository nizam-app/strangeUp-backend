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
    note: "Hello there",
  };
}

const describeMeetup = runIntegration ? describe : describe.skip;

describeMeetup("integration: meetup invites 028D", () => {
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
    await db.$disconnect();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    clearRateLimits();
    await db.personalMeetupInvitation.deleteMany({});
    await db.userBlock.deleteMany({});
  });

  it("creates PENDING invite and lists incoming with redacted venue on list", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "meetup-sender", {
      profileVisibility: "EVERYONE",
    });
    const recipient = await createIntegrationUser(app, emailSender, db, "meetup-recipient", {
      profileVisibility: "EVERYONE",
    });

    const create = await request(app)
      .post("/v1/meetup-invites")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .send(createBody(recipient.userId));
    expect(create.status).toBe(201);
    const inviteId = create.body.data.id as string;
    expect(create.body.data.status).toBe("PENDING");

    const list = await request(app)
      .get("/v1/meetup-invites?box=incoming&status=pending")
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.invites).toHaveLength(1);
    expect(list.body.data.invites[0].venue.label).toBeNull();
    expect(list.body.data.invites[0].venue.addressLine).toBeNull();
    expect(list.body.data.counts.pending).toBe(1);

    const detailRecipient = await request(app)
      .get(`/v1/meetup-invites/${inviteId}`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(detailRecipient.status).toBe(200);
    expect(detailRecipient.body.data.venue.label).toBeNull();
    expect(detailRecipient.body.data.venue.city).toBe("Miami Beach");

    const detailSender = await request(app)
      .get(`/v1/meetup-invites/${inviteId}`)
      .set("Authorization", `Bearer ${sender.accessToken}`);
    expect(detailSender.body.data.venue.label).toBe("Secret Cafe");
  });

  it("returns 404 for third party and blocked participant", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "meetup-sender2");
    const recipient = await createIntegrationUser(app, emailSender, db, "meetup-recipient2");
    const stranger = await createIntegrationUser(app, emailSender, db, "meetup-stranger");

    const create = await request(app)
      .post("/v1/meetup-invites")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .send(createBody(recipient.userId));
    const inviteId = create.body.data.id as string;

    const strangerGet = await request(app)
      .get(`/v1/meetup-invites/${inviteId}`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(strangerGet.status).toBe(404);

    await db.userBlock.create({
      data: { blockerId: recipient.userId, blockedId: sender.userId },
    });

    const blockedGet = await request(app)
      .get(`/v1/meetup-invites/${inviteId}`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(blockedGet.status).toBe(404);
  });

  it("enforces idempotency and duplicate pending conflict", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "meetup-idem-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "meetup-idem-r");
    const body = createBody(recipient.userId);
    const key = "test-idem-key-028d";

    const first = await request(app)
      .post("/v1/meetup-invites")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .set("Idempotency-Key", key)
      .send(body);
    expect(first.status).toBe(201);

    const replay = await request(app)
      .post("/v1/meetup-invites")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .set("Idempotency-Key", key)
      .send(body);
    expect(replay.status).toBe(200);
    expect(replay.body.data.id).toBe(first.body.data.id);

    const conflictPayload = await request(app)
      .post("/v1/meetup-invites")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .set("Idempotency-Key", key)
      .send({ ...body, title: "Different title" });
    expect(conflictPayload.status).toBe(409);

    await db.personalMeetupInvitation.updateMany({
      where: { senderId: sender.userId },
      data: { createIdempotencyKey: null },
    });

    const duplicate = await request(app)
      .post("/v1/meetup-invites")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .send(body);
    expect(duplicate.status).toBe(409);
  });

  it("lazy-expires overdue PENDING on list", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "meetup-exp-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "meetup-exp-r");

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
      },
    });

    const list = await request(app)
      .get("/v1/meetup-invites?box=incoming&status=expired")
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.invites.some((i: { id: string }) => i.id === row.id)).toBe(true);

    const stored = await db.personalMeetupInvitation.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.status).toBe("EXPIRED");
  });

  it("rejects create without main-app activation", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "meetup-noact-s", {
      mainAppAccess: false,
    });
    const recipient = await createIntegrationUser(app, emailSender, db, "meetup-noact-r");

    const res = await request(app)
      .post("/v1/meetup-invites")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .send(createBody(recipient.userId));
    expect(res.status).toBe(403);
  });
});
