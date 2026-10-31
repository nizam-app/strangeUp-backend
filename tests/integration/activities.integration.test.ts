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
): Promise<{ accessToken: string; userId: string; email: string }> {
  return createIntegrationUser(app, emailSender, db, prefix, {
    mainAppAccess: options?.mainAppAccess,
  });
}

function futureWindow(hoursFromNow = 48): { startsAt: string; endsAt: string } {
  const starts = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const ends = new Date(starts.getTime() + 2 * 60 * 60 * 1000);
  return { startsAt: starts.toISOString(), endsAt: ends.toISOString() };
}

async function createDraft(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  overrides: Record<string, unknown> = {},
) {
  const schedule = futureWindow();
  return request(app)
    .post("/v1/me/activities")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      title: "Morning ride",
      category: "biking",
      ...schedule,
      timeZone: "America/New_York",
      mode: "IN_PERSON",
      venueName: "Bayfront Park",
      locationCity: "Miami",
      locationRegion: "FL",
      meetingInstructions: "Meet at the south fountain",
      capacity: 2,
      waitlistEnabled: true,
      ...overrides,
    });
}

const describeActivities = runIntegration ? describe : describe.skip;

describeActivities("integration: activities & meetups (Task 010)", () => {
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

  it("T010-P01 activated viewer browses published activities; drafts stay hidden", async () => {
    const host = await verifiedUser(app, emailSender, db, "t010-host");
    const viewer = await verifiedUser(app, emailSender, db, "t010-viewer");
    const draft = await createDraft(app, host.accessToken);
    expect(draft.status).toBe(201);
    expect(draft.body.data.status).toBe("DRAFT");
    expect(draft.body.data).toHaveProperty("meetingInstructions");

    const listBefore = await request(app)
      .get("/v1/activities")
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(listBefore.status).toBe(200);
    expect(
      listBefore.body.data.activities.some(
        (row: { activityId: string }) => row.activityId === draft.body.data.activityId,
      ),
    ).toBe(false);

    const publish = await request(app)
      .post(`/v1/me/activities/${draft.body.data.activityId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(publish.status).toBe(200);
    expect(publish.body.data.status).toBe("PUBLISHED");

    const list = await request(app)
      .get("/v1/activities?category=biking")
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(list.status).toBe(200);
    const found = list.body.data.activities.find(
      (row: { activityId: string }) => row.activityId === draft.body.data.activityId,
    );
    expect(found).toBeTruthy();
    expect(found).not.toHaveProperty("meetingInstructions");
    expect(found).not.toHaveProperty("latitude");
  });

  it("T010-N01 unauthorized and other-user host mutations are rejected", async () => {
    const host = await verifiedUser(app, emailSender, db, "t010-owner");
    const other = await verifiedUser(app, emailSender, db, "t010-other");
    const created = await createDraft(app, host.accessToken);
    const activityId = created.body.data.activityId as string;

    const anon = await request(app).get("/v1/activities");
    expect(anon.status).toBe(401);

    const inject = await request(app)
      .patch(`/v1/me/activities/${activityId}`)
      .set("Authorization", `Bearer ${other.accessToken}`)
      .send({ title: "Hijacked", hostId: other.userId, status: "PUBLISHED" });
    expect([400, 404]).toContain(inject.status);

    const foreignPublish = await request(app)
      .post(`/v1/me/activities/${activityId}/publish`)
      .set("Authorization", `Bearer ${other.accessToken}`);
    expect(foreignPublish.status).toBe(404);
  });

  it("T010-P02 pending users denied main app; activated users publish and RSVP", async () => {
    const pendingHost = await verifiedUser(app, emailSender, db, "t010-nokyc-host", {
      mainAppAccess: false,
    });
    const activatedHost = await verifiedUser(app, emailSender, db, "t010-kyc-host");
    const pendingGuest = await verifiedUser(app, emailSender, db, "t010-nokyc-guest", {
      mainAppAccess: false,
    });
    const activatedGuest = await verifiedUser(app, emailSender, db, "t010-kyc-guest");

    const blockedDraft = await createDraft(app, pendingHost.accessToken);
    expect(blockedDraft.status).toBe(403);
    expect(blockedDraft.body.error.code).toBe("ONBOARDING_REQUIRED");

    const virtual = await createDraft(app, activatedHost.accessToken, {
      mode: "VIRTUAL",
      virtualMeetingDetails: "Use the club video room",
      venueName: undefined,
      locationCity: undefined,
    });
    expect(virtual.status).toBe(201);
    const publishVirtual = await request(app)
      .post(`/v1/me/activities/${virtual.body.data.activityId}/publish`)
      .set("Authorization", `Bearer ${activatedHost.accessToken}`);
    expect(publishVirtual.status).toBe(200);

    const inPerson = await createDraft(app, activatedHost.accessToken, {
      capacity: 1,
      waitlistEnabled: true,
    });
    const published = await request(app)
      .post(`/v1/me/activities/${inPerson.body.data.activityId}/publish`)
      .set("Authorization", `Bearer ${activatedHost.accessToken}`);
    expect(published.status).toBe(200);
    const activityId = published.body.data.activityId as string;

    const pendingJoin = await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${pendingGuest.accessToken}`);
    expect(pendingJoin.status).toBe(403);
    expect(pendingJoin.body.error.code).toBe("ONBOARDING_REQUIRED");

    const confirmed = await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${activatedGuest.accessToken}`);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.state).toBe("CONFIRMED");

    const waitlisted = await verifiedUser(app, emailSender, db, "t010-wait-guest");
    const waitlistJoin = await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${waitlisted.accessToken}`);
    expect(waitlistJoin.status).toBe(200);
    expect(waitlistJoin.body.data.state).toBe("WAITLISTED");
  });

  it("T010-C01 duplicate join is idempotent and cancellation promotes only eligible waitlist heads", async () => {
    const host = await verifiedUser(app, emailSender, db, "t010-cap-host");
    const first = await verifiedUser(app, emailSender, db, "t010-cap-1");
    const waitlisted = await verifiedUser(app, emailSender, db, "t010-cap-2");
    const created = await createDraft(app, host.accessToken, {
      capacity: 1,
      waitlistEnabled: true,
    });
    await request(app)
      .post(`/v1/me/activities/${created.body.data.activityId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    const activityId = created.body.data.activityId as string;

    const joinA = await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${first.accessToken}`);
    const joinAAgain = await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${first.accessToken}`);
    expect(joinA.status).toBe(200);
    expect(joinAAgain.status).toBe(200);
    expect(joinAAgain.body.data.state).toBe("CONFIRMED");

    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${waitlisted.accessToken}`);

    const leave = await request(app)
      .delete(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${first.accessToken}`);
    expect(leave.status).toBe(200);
    expect(leave.body.data.promoted).toBe(true);

    const mine = await request(app)
      .get("/v1/me/activity-rsvps")
      .set("Authorization", `Bearer ${waitlisted.accessToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.rsvps[0].myParticipation.state).toBe("CONFIRMED");

    const raceHost = await verifiedUser(app, emailSender, db, "t010-race-host");
    const racerA = await verifiedUser(app, emailSender, db, "t010-race-a");
    const racerB = await verifiedUser(app, emailSender, db, "t010-race-b");
    const raceDraft = await createDraft(app, raceHost.accessToken, {
      capacity: 1,
      waitlistEnabled: false,
    });
    await request(app)
      .post(`/v1/me/activities/${raceDraft.body.data.activityId}/publish`)
      .set("Authorization", `Bearer ${raceHost.accessToken}`);
    const raceId = raceDraft.body.data.activityId as string;
    const [firstSeat, secondSeat] = await Promise.all([
      request(app)
        .post(`/v1/activities/${raceId}/rsvp`)
        .set("Authorization", `Bearer ${racerA.accessToken}`),
      request(app)
        .post(`/v1/activities/${raceId}/rsvp`)
        .set("Authorization", `Bearer ${racerB.accessToken}`),
    ]);
    const confirmedSeats = [firstSeat, secondSeat].filter(
      (res) => res.status === 200 && res.body.data?.state === "CONFIRMED",
    );
    const rejectedSeats = [firstSeat, secondSeat].filter((res) => res.status === 409);
    expect(confirmedSeats).toHaveLength(1);
    expect(rejectedSeats).toHaveLength(1);
  });

  it("T010-N02 blocks hide discovery, RSVP and meeting; meeting stays private", async () => {
    const host = await verifiedUser(app, emailSender, db, "t010-block-host");
    const guest = await verifiedUser(app, emailSender, db, "t010-block-guest");
    const created = await createDraft(app, host.accessToken);
    await request(app)
      .post(`/v1/me/activities/${created.body.data.activityId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    const activityId = created.body.data.activityId as string;

    const publicDetail = await request(app)
      .get(`/v1/activities/${activityId}`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(publicDetail.status).toBe(200);
    expect(publicDetail.body.data).not.toHaveProperty("meetingInstructions");
    expect(publicDetail.body.data.meetingAvailable).toBe(false);

    const deniedMeeting = await request(app)
      .get(`/v1/activities/${activityId}/meeting`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(deniedMeeting.status).toBe(403);

    const joined = await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(joined.status).toBe(200);
    const meeting = await request(app)
      .get(`/v1/activities/${activityId}/meeting`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(meeting.status).toBe(200);
    expect(meeting.body.data.meetingInstructions).toBe("Meet at the south fountain");

    await request(app)
      .post("/v1/me/blocks")
      .set("Authorization", `Bearer ${guest.accessToken}`)
      .send({ targetUserId: host.userId });

    const hidden = await request(app)
      .get(`/v1/activities/${activityId}`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(hidden.status).toBe(404);

    const blockedJoin = await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(blockedJoin.status).toBe(404);
  });

  it("T025C-P01 activities hidden when host loses main-app activation", async () => {
    const viewer = await verifiedUser(app, emailSender, db, "t025c-viewer");
    const host = await verifiedUser(app, emailSender, db, "t025c-host");
    const created = await createDraft(app, host.accessToken, { title: "Revocation Ride" });
    await request(app)
      .post(`/v1/me/activities/${created.body.data.activityId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    const activityId = created.body.data.activityId as string;

    const visible = await request(app)
      .get("/v1/activities?q=Revocation")
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(visible.status).toBe(200);
    expect(
      visible.body.data.activities.some((a: { activityId: string }) => a.activityId === activityId),
    ).toBe(true);

    await db.user.update({
      where: { id: host.userId },
      data: { adminReviewStatus: "PENDING", adminReviewVerificationSessionId: null },
    });

    const hiddenList = await request(app)
      .get("/v1/activities?q=Revocation")
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(hiddenList.status).toBe(200);
    expect(
      hiddenList.body.data.activities.some(
        (a: { activityId: string }) => a.activityId === activityId,
      ),
    ).toBe(false);

    const detail = await request(app)
      .get(`/v1/activities/${activityId}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(detail.status).toBe(404);
  });

  it("T025C-P02 search q matches host display name", async () => {
    const host = await verifiedUser(app, emailSender, db, "t025c-hostsearch");
    const viewer = await verifiedUser(app, emailSender, db, "t025c-viewsearch");
    const tag = `HostSearch${Date.now()}`;
    await db.profile.update({
      where: { userId: host.userId },
      data: { displayName: tag },
    });
    const created = await createDraft(app, host.accessToken, { title: "Unrelated title xyz" });
    await request(app)
      .post(`/v1/me/activities/${created.body.data.activityId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`);

    const list = await request(app)
      .get(`/v1/activities?q=${encodeURIComponent(tag)}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(list.status).toBe(200);
    expect(
      list.body.data.activities.some(
        (a: { activityId: string }) => a.activityId === created.body.data.activityId,
      ),
    ).toBe(true);
  });

  it("T010-N03 FOLLOWERS_ONLY cannot be published; cancelled activities reject joins", async () => {
    const host = await verifiedUser(app, emailSender, db, "t010-aud-host");
    const guest = await verifiedUser(app, emailSender, db, "t010-aud-guest");
    const created = await createDraft(app, host.accessToken, { audience: "FOLLOWERS_ONLY" });
    const publish = await request(app)
      .post(`/v1/me/activities/${created.body.data.activityId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(publish.status).toBe(400);

    const publicDraft = await createDraft(app, host.accessToken);
    await request(app)
      .post(`/v1/me/activities/${publicDraft.body.data.activityId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    await request(app)
      .post(`/v1/me/activities/${publicDraft.body.data.activityId}/cancel`)
      .set("Authorization", `Bearer ${host.accessToken}`);

    const joinCancelled = await request(app)
      .post(`/v1/activities/${publicDraft.body.data.activityId}/rsvp`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(joinCancelled.status).toBe(404);
  });
});
