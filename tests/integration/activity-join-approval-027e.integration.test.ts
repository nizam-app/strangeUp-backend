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

function futureWindow(hoursFromNow: number): { startsAt: string; endsAt: string } {
  const starts = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const ends = new Date(starts.getTime() + 2 * 60 * 60 * 1000);
  return { startsAt: starts.toISOString(), endsAt: ends.toISOString() };
}

function inPersonDraft(title: string, schedule: { startsAt: string; endsAt: string }, extra = {}) {
  return {
    title,
    category: "biking",
    ...schedule,
    timeZone: "America/New_York",
    mode: "IN_PERSON",
    venueName: "Bayfront Park",
    locationCity: "Miami",
    locationRegion: "FL",
    meetingInstructions: "Main gate",
    capacity: 2,
    waitlistEnabled: true,
    ...extra,
  };
}

describe.runIf(runIntegration)("Task 027E hybrid join approval (Neon)", () => {
  let db: DatabaseClient;
  let app: ReturnType<typeof createApp>;
  let emailSender: ReturnType<typeof createCapturingEmailSender>;

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
    emailSender = createCapturingEmailSender();
    app = createApp({ env, db, logger: pino({ level: "silent" }), emailSender });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeEach(() => {
    clearRateLimits();
  });

  it("T027E-01 AUTO join regression remains instant confirm", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027e-auto-host");
    const guest = await createIntegrationUser(app, emailSender, db, "t027e-auto-guest");
    const schedule = futureWindow(60);
    const draft = await request(app)
      .post("/v1/me/activities")
      .set("Authorization", `Bearer ${host.accessToken}`)
      .send(inPersonDraft("Auto ride", schedule, { joinMode: "AUTO", capacity: 8 }));
    expect(draft.status).toBe(201);
    expect(draft.body.data.joinMode).toBe("AUTO");
    const activityId = draft.body.data.activityId as string;
    await request(app)
      .post(`/v1/me/activities/${activityId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`)
      .expect(200);
    const rsvp = await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(rsvp.status).toBe(200);
    expect(rsvp.body.data.state).toBe("CONFIRMED");
    expect(rsvp.body.data.participationStatus).toBe("AUTO_CONFIRMED");
  });

  it("T027E-02 HOST_APPROVAL creates PENDING without meeting access", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027e-ha-host");
    const guest = await createIntegrationUser(app, emailSender, db, "t027e-ha-guest");
    const schedule = futureWindow(70);
    const draft = await request(app)
      .post("/v1/me/activities")
      .set("Authorization", `Bearer ${host.accessToken}`)
      .send(inPersonDraft("Approval ride", schedule, { joinMode: "HOST_APPROVAL" }));
    const activityId = draft.body.data.activityId as string;
    await request(app)
      .post(`/v1/me/activities/${activityId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`)
      .expect(200);
    const rsvp = await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(rsvp.status).toBe(200);
    expect(rsvp.body.data.state).toBe("PENDING");
    expect(rsvp.body.data.participationStatus).toBe("APPROVAL_PENDING");
    const meeting = await request(app)
      .get(`/v1/activities/${activityId}/meeting`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(meeting.status).toBe(403);
  });

  it("T027E-03 host approve, decline, withdraw, and inventory pending view", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027e-flow-host");
    const a = await createIntegrationUser(app, emailSender, db, "t027e-flow-a");
    const b = await createIntegrationUser(app, emailSender, db, "t027e-flow-b");
    const schedule = futureWindow(80);
    const draft = await request(app)
      .post("/v1/me/activities")
      .set("Authorization", `Bearer ${host.accessToken}`)
      .send(inPersonDraft("Flow", schedule, { joinMode: "HOST_APPROVAL", capacity: 1 }));
    const activityId = draft.body.data.activityId as string;
    await request(app)
      .post(`/v1/me/activities/${activityId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`)
      .expect(200);

    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .expect(200);
    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${b.accessToken}`)
      .expect(200);

    const pendingList = await request(app)
      .get(`/v1/me/activities/${activityId}/join-requests`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(pendingList.status).toBe(200);
    expect(pendingList.body.data.requests.length).toBe(2);

    const hostDetail = await request(app)
      .get(`/v1/me/activities/${activityId}`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(hostDetail.body.data.hostParticipationSummary.pendingRequestCount).toBe(2);

    await request(app)
      .post(`/v1/me/activities/${activityId}/join-requests/${a.userId}/approve`)
      .set("Authorization", `Bearer ${host.accessToken}`)
      .expect(200);
    await request(app)
      .post(`/v1/me/activities/${activityId}/join-requests/${b.userId}/decline`)
      .set("Authorization", `Bearer ${host.accessToken}`)
      .expect(200);

    const fullApprove = await request(app)
      .post(`/v1/me/activities/${activityId}/join-requests/${b.userId}/approve`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(fullApprove.status).toBe(409);

    const inventory = await request(app)
      .get("/v1/me/activity-inventory")
      .query({ view: "pending", includeCounts: "true" })
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(inventory.status).toBe(200);
    expect(inventory.body.data.items.length).toBe(0);

    await request(app)
      .delete(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .expect(200);

    const unauthorized = await request(app)
      .get(`/v1/me/activities/${activityId}/join-requests`)
      .set("Authorization", `Bearer ${a.accessToken}`);
    expect(unauthorized.status).toBe(404);
  });
});
