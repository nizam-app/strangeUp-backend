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
import { publicActivityDtoContainsSensitiveKeys } from "../../src/modules/activities/activity.dto.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";

function futureWindow(hoursFromNow: number): { startsAt: string; endsAt: string } {
  const starts = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const ends = new Date(starts.getTime() + 2 * 60 * 60 * 1000);
  return { startsAt: starts.toISOString(), endsAt: ends.toISOString() };
}

async function publishActivity(
  app: ReturnType<typeof createApp>,
  hostToken: string,
  capacity = 8,
) {
  const schedule = futureWindow(50);
  const draft = await request(app)
    .post("/v1/me/activities")
    .set("Authorization", `Bearer ${hostToken}`)
    .send({
      title: "Roster ride",
      category: "biking",
      ...schedule,
      timeZone: "America/New_York",
      mode: "IN_PERSON",
      venueName: "Park",
      locationCity: "Miami",
      locationRegion: "FL",
      meetingInstructions: "Secret gate",
      capacity,
      waitlistEnabled: true,
    });
  expect(draft.status).toBe(201);
  const activityId = draft.body.data.activityId as string;
  await request(app)
    .post(`/v1/me/activities/${activityId}/publish`)
    .set("Authorization", `Bearer ${hostToken}`)
    .expect(200);
  return activityId;
}

describe.runIf(runIntegration)("Task 027F activity roster (Neon)", () => {
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

  it("T027F-01 host and confirmed participant can read roster; count matches detail", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027f-host");
    const guest = await createIntegrationUser(app, emailSender, db, "t027f-guest");
    const activityId = await publishActivity(app, host.accessToken, 4);
    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${guest.accessToken}`)
      .expect(200);

    const detail = await request(app)
      .get(`/v1/activities/${activityId}`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).not.toHaveProperty("attendees");

    const hostRoster = await request(app)
      .get(`/v1/activities/${activityId}/participants`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(hostRoster.status).toBe(200);
    expect(hostRoster.body.data.confirmedCount).toBe(1);
    expect(hostRoster.body.data.attendees).toHaveLength(1);
    expect(hostRoster.body.data.confirmedCount).toBe(detail.body.data.confirmedCount);

    const guestRoster = await request(app)
      .get(`/v1/activities/${activityId}/participants`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(guestRoster.status).toBe(200);
    expect(JSON.stringify(guestRoster.body)).not.toMatch(
      /meetingInstructions|virtualMeetingDetails|identityVerification|email/,
    );
  });

  it("T027F-02 denies anonymous, pending, waitlisted, and non-participants", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027f-deny-host");
    const pendingGuest = await createIntegrationUser(app, emailSender, db, "t027f-pending");
    const outsider = await createIntegrationUser(app, emailSender, db, "t027f-outsider");
    const confirmed = await createIntegrationUser(app, emailSender, db, "t027f-conf");
    const waitlisted = await createIntegrationUser(app, emailSender, db, "t027f-wl");

    const schedule = futureWindow(55);
    const haDraft = await request(app)
      .post("/v1/me/activities")
      .set("Authorization", `Bearer ${host.accessToken}`)
      .send({
        title: "Approval roster deny",
        category: "biking",
        ...schedule,
        timeZone: "America/New_York",
        mode: "IN_PERSON",
        venueName: "Park",
        locationCity: "Miami",
        meetingInstructions: "Gate",
        capacity: 4,
        joinMode: "HOST_APPROVAL",
      });
    const haId = haDraft.body.data.activityId as string;
    await request(app)
      .post(`/v1/me/activities/${haId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    await request(app)
      .post(`/v1/activities/${haId}/rsvp`)
      .set("Authorization", `Bearer ${pendingGuest.accessToken}`);
    const pendingRoster = await request(app)
      .get(`/v1/activities/${haId}/participants`)
      .set("Authorization", `Bearer ${pendingGuest.accessToken}`);
    expect(pendingRoster.status).toBe(404);

    const activityId = await publishActivity(app, host.accessToken, 1);
    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${confirmed.accessToken}`)
      .expect(200);
    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${waitlisted.accessToken}`)
      .expect(200);
    const wlRoster = await request(app)
      .get(`/v1/activities/${activityId}/participants`)
      .set("Authorization", `Bearer ${waitlisted.accessToken}`);
    expect(wlRoster.status).toBe(404);

    const anon = await request(app).get(`/v1/activities/${activityId}/participants`);
    expect(anon.status).toBe(401);

    const outsiderRoster = await request(app)
      .get(`/v1/activities/${activityId}/participants`)
      .set("Authorization", `Bearer ${outsider.accessToken}`);
    expect(outsiderRoster.status).toBe(404);
  });

  it("T027F-03 cross-activity denial and post-leave revalidation", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027f-x-host");
    const guest = await createIntegrationUser(app, emailSender, db, "t027f-x-guest");
    const a = await publishActivity(app, host.accessToken);
    const b = await publishActivity(app, host.accessToken);
    await request(app)
      .post(`/v1/activities/${a}/rsvp`)
      .set("Authorization", `Bearer ${guest.accessToken}`)
      .expect(200);

    const cross = await request(app)
      .get(`/v1/activities/${b}/participants`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(cross.status).toBe(404);

    await request(app)
      .delete(`/v1/activities/${a}/rsvp`)
      .set("Authorization", `Bearer ${guest.accessToken}`)
      .expect(200);
    const afterLeave = await request(app)
      .get(`/v1/activities/${a}/participants`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(afterLeave.status).toBe(404);
  });

  it("T027F-04 preview cap, pagination order, and D-03 redaction", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027f-page-host");
    const u1 = await createIntegrationUser(app, emailSender, db, "t027f-u1", {
      profileVisibility: "EVERYONE",
    });
    const u2 = await createIntegrationUser(app, emailSender, db, "t027f-u2", {
      profileVisibility: "EVERYONE",
    });
    const u3 = await createIntegrationUser(app, emailSender, db, "t027f-u3", {
      profileVisibility: "EVERYONE",
    });
    await db.profile.update({
      where: { userId: u3.userId },
      data: {
        displayName: "BlockedName",
        username: `t027fblk${u3.userId.replace(/-/g, "").slice(0, 12)}`,
      },
    });

    const activityId = await publishActivity(app, host.accessToken, 10);
    for (const user of [u1, u2, u3]) {
      await request(app)
        .post(`/v1/activities/${activityId}/rsvp`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .expect(200);
    }

    const preview = await request(app)
      .get(`/v1/activities/${activityId}/participants`)
      .query({ preview: "true", limit: 50 })
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(preview.status).toBe(200);
    expect(preview.body.data.attendees.length).toBeLessThanOrEqual(5);
    expect(preview.body.data.confirmedCount).toBe(3);

    const page1 = await request(app)
      .get(`/v1/activities/${activityId}/participants`)
      .query({ limit: 2 })
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(page1.body.data.attendees).toHaveLength(2);
    const cursor = page1.body.meta.nextCursor as string;
    expect(cursor).toBeTruthy();

    const page2 = await request(app)
      .get(`/v1/activities/${activityId}/participants`)
      .query({ limit: 2, cursor })
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(page2.body.data.attendees.length).toBeGreaterThanOrEqual(1);

    const ids = [
      ...page1.body.data.attendees.map((a: { userId: string }) => a.userId),
      ...page2.body.data.attendees.map((a: { userId: string }) => a.userId),
    ];
    expect(new Set(ids).size).toBe(ids.length);

    await request(app)
      .post("/v1/me/blocks")
      .set("Authorization", `Bearer ${u1.accessToken}`)
      .send({ targetUserId: u3.userId });

    const blockedView = await request(app)
      .get(`/v1/activities/${activityId}/participants`)
      .set("Authorization", `Bearer ${u1.accessToken}`);
    const redactedRow = blockedView.body.data.attendees.find(
      (a: { userId: string }) => a.userId === u3.userId,
    );
    expect(redactedRow?.profile.displayName).toBeNull();

    for (const attendee of preview.body.data.attendees as object[]) {
      expect(publicActivityDtoContainsSensitiveKeys(attendee)).toBe(false);
    }
  });
});
