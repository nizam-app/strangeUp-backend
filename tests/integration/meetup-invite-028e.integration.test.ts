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

async function createPendingInvite(
  app: ReturnType<typeof createApp>,
  senderToken: string,
  recipientUserId: string,
): Promise<string> {
  const res = await request(app)
    .post("/v1/meetup-invites")
    .set("Authorization", `Bearer ${senderToken}`)
    .send(createBody(recipientUserId));
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

const describeMeetup = runIntegration ? describe : describe.skip;

describeMeetup("integration: meetup invites 028E mutations", () => {
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

  it("accept reveals venue to recipient and clears incoming pending count", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028e-acc-s", {
      profileVisibility: "EVERYONE",
    });
    const recipient = await createIntegrationUser(app, emailSender, db, "028e-acc-r", {
      profileVisibility: "EVERYONE",
    });
    const inviteId = await createPendingInvite(app, sender.accessToken, recipient.userId);

    const beforeList = await request(app)
      .get("/v1/meetup-invites?box=incoming&status=pending")
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(beforeList.body.data.counts.pending).toBe(1);

    const accept = await request(app)
      .post(`/v1/meetup-invites/${inviteId}/accept`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(accept.status).toBe(200);
    expect(accept.body.data.status).toBe("ACCEPTED");
    expect(accept.body.data.venue.label).toBe("Secret Cafe");
    expect(accept.body.data.acceptedAt).toBeTruthy();
    expect(accept.body.data.actions.canAccept).toBe(false);

    const repeat = await request(app)
      .post(`/v1/meetup-invites/${inviteId}/accept`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(repeat.status).toBe(200);
    expect(repeat.body.data.status).toBe("ACCEPTED");

    const afterList = await request(app)
      .get("/v1/meetup-invites?box=incoming&status=pending")
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(afterList.body.data.counts.pending).toBe(0);

    const detail = await request(app)
      .get(`/v1/meetup-invites/${inviteId}`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(detail.body.data.venue.addressLine).toBe("1875 Purdy Ave");
  });

  it("decline and withdraw are role-bound and idempotent", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028e-dec-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028e-dec-r");
    const inviteDecline = await createPendingInvite(app, sender.accessToken, recipient.userId);

    const senderDecline = await request(app)
      .post(`/v1/meetup-invites/${inviteDecline}/decline`)
      .set("Authorization", `Bearer ${sender.accessToken}`);
    expect(senderDecline.status).toBe(403);

    const decline = await request(app)
      .post(`/v1/meetup-invites/${inviteDecline}/decline`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(decline.status).toBe(200);
    expect(decline.body.data.status).toBe("DECLINED");
    expect(decline.body.data.declinedAt).toBeTruthy();

    const declineAgain = await request(app)
      .post(`/v1/meetup-invites/${inviteDecline}/decline`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(declineAgain.status).toBe(200);

    const sender2 = await createIntegrationUser(app, emailSender, db, "028e-wd-s");
    const recipient2 = await createIntegrationUser(app, emailSender, db, "028e-wd-r");
    const inviteWithdraw = await createPendingInvite(app, sender2.accessToken, recipient2.userId);

    const recipientWithdraw = await request(app)
      .post(`/v1/meetup-invites/${inviteWithdraw}/withdraw`)
      .set("Authorization", `Bearer ${recipient2.accessToken}`);
    expect(recipientWithdraw.status).toBe(403);

    const withdraw = await request(app)
      .post(`/v1/meetup-invites/${inviteWithdraw}/withdraw`)
      .set("Authorization", `Bearer ${sender2.accessToken}`);
    expect(withdraw.status).toBe(200);
    expect(withdraw.body.data.status).toBe("WITHDRAWN");

    const stored = await db.personalMeetupInvitation.findUniqueOrThrow({
      where: { id: inviteWithdraw },
    });
    expect(stored.title).toBe("Coffee Meetup");
    expect(stored.withdrawnAt).toBeTruthy();
  });

  it("returns 404 for stranger and 409 for conflicting terminal action", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028e-conf-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028e-conf-r");
    const stranger = await createIntegrationUser(app, emailSender, db, "028e-conf-x");
    const inviteId = await createPendingInvite(app, sender.accessToken, recipient.userId);

    const strangerAccept = await request(app)
      .post(`/v1/meetup-invites/${inviteId}/accept`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(strangerAccept.status).toBe(404);

    await request(app)
      .post(`/v1/meetup-invites/${inviteId}/accept`)
      .set("Authorization", `Bearer ${recipient.accessToken}`)
      .expect(200);

    const conflictDecline = await request(app)
      .post(`/v1/meetup-invites/${inviteId}/decline`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(conflictDecline.status).toBe(409);
  });

  it("rejects accept after lazy expiry", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028e-exp-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028e-exp-r");
    const row = await db.personalMeetupInvitation.create({
      data: {
        senderId: sender.userId,
        recipientId: recipient.userId,
        status: "PENDING",
        meetupType: "COFFEE",
        title: "Past meetup",
        scheduledStartsAt: new Date(Date.now() - 120_000),
        scheduleTimeZone: "UTC",
        venueCity: "Miami Beach",
        venueRegion: "FL",
        venueLabel: "Hidden",
        venueAddressLine: "1 Old St",
      },
    });

    const accept = await request(app)
      .post(`/v1/meetup-invites/${row.id}/accept`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(accept.status).toBe(409);

    const stored = await db.personalMeetupInvitation.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.status).toBe("EXPIRED");
  });

  it("rejects accept when recipient KYC is revoked", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028e-kyc-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028e-kyc-r");
    const inviteId = await createPendingInvite(app, sender.accessToken, recipient.userId);

    await db.user.update({
      where: { id: recipient.userId },
      data: { identityVerificationRevokedAt: new Date() },
    });

    const accept = await request(app)
      .post(`/v1/meetup-invites/${inviteId}/accept`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(accept.status).toBe(403);
  });

  it("concurrent accept vs decline yields one success and one conflict", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028e-race-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028e-race-r");
    const inviteId = await createPendingInvite(app, sender.accessToken, recipient.userId);

    const [acceptRes, declineRes] = await Promise.all([
      request(app)
        .post(`/v1/meetup-invites/${inviteId}/accept`)
        .set("Authorization", `Bearer ${recipient.accessToken}`),
      request(app)
        .post(`/v1/meetup-invites/${inviteId}/decline`)
        .set("Authorization", `Bearer ${recipient.accessToken}`),
    ]);

    const statuses = [acceptRes.status, declineRes.status].sort();
    expect(statuses).toEqual([200, 409]);

    const final = await db.personalMeetupInvitation.findUniqueOrThrow({ where: { id: inviteId } });
    expect(["ACCEPTED", "DECLINED"]).toContain(final.status);
  });

  it("concurrent accept vs withdraw yields one success and one conflict", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028e-race2-s");
    const recipient = await createIntegrationUser(app, emailSender, db, "028e-race2-r");
    const inviteId = await createPendingInvite(app, sender.accessToken, recipient.userId);

    const [acceptRes, withdrawRes] = await Promise.all([
      request(app)
        .post(`/v1/meetup-invites/${inviteId}/accept`)
        .set("Authorization", `Bearer ${recipient.accessToken}`),
      request(app)
        .post(`/v1/meetup-invites/${inviteId}/withdraw`)
        .set("Authorization", `Bearer ${sender.accessToken}`),
    ]);

    const statuses = [acceptRes.status, withdrawRes.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it("028D create/list/detail regression and social follow/wave still work", async () => {
    const sender = await createIntegrationUser(app, emailSender, db, "028e-reg-s", {
      profileVisibility: "EVERYONE",
    });
    const recipient = await createIntegrationUser(app, emailSender, db, "028e-reg-r", {
      profileVisibility: "EVERYONE",
    });
    const inviteId = await createPendingInvite(app, sender.accessToken, recipient.userId);

    const list = await request(app)
      .get("/v1/meetup-invites?box=outgoing")
      .set("Authorization", `Bearer ${sender.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.invites.some((i: { id: string }) => i.id === inviteId)).toBe(true);

    const follow = await request(app)
      .post(`/v1/users/${recipient.userId}/follow`)
      .set("Authorization", `Bearer ${sender.accessToken}`);
    expect(follow.status).toBe(200);

    const wave = await request(app)
      .post(`/v1/users/${recipient.userId}/wave`)
      .set("Authorization", `Bearer ${sender.accessToken}`);
    expect(wave.status).toBe(200);
  });
});
