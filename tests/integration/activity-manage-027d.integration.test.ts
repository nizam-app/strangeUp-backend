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

function futureWindow(hoursFromNow = 48): { startsAt: string; endsAt: string } {
  const starts = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const ends = new Date(starts.getTime() + 2 * 60 * 60 * 1000);
  return { startsAt: starts.toISOString(), endsAt: ends.toISOString() };
}

describe.runIf(runIntegration)("Task 027D activity manage (Neon)", () => {
  let db: DatabaseClient;
  let app: ReturnType<typeof createApp>;
  let emailSender: ReturnType<typeof createCapturingEmailSender>;

  beforeAll(() => {
    const env = loadEnv();
    db = createPrismaClient(env.DATABASE_URL!);
    emailSender = createCapturingEmailSender();
    app = createApp({ env, db, logger: pino({ level: "silent" }), emailSender });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeEach(() => {
    clearRateLimits();
  });

  it("T027D-M01 blocks schedule edits after participants register", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027d-sched-host");
    const guest = await createIntegrationUser(app, emailSender, db, "t027d-sched-guest");
    const schedule = futureWindow();
    const draft = await request(app)
      .post("/v1/me/activities")
      .set("Authorization", `Bearer ${host.accessToken}`)
      .send({
        title: "Schedule lock ride",
        category: "biking",
        ...schedule,
        timeZone: "America/New_York",
        mode: "IN_PERSON",
        venueName: "Park",
        locationCity: "Miami",
        locationRegion: "FL",
        meetingInstructions: "Gate 1",
        capacity: 4,
      });
    const activityId = draft.body.data.activityId as string;
    await request(app)
      .post(`/v1/me/activities/${activityId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`);

    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${guest.accessToken}`);

    const patch = await request(app)
      .patch(`/v1/me/activities/${activityId}`)
      .set("Authorization", `Bearer ${host.accessToken}`)
      .send({ startsAt: futureWindow(96).startsAt });
    expect(patch.status).toBe(409);
  });

  it("T027D-M02 rejects capacity below confirmed count", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027d-cap-host");
    const guestA = await createIntegrationUser(app, emailSender, db, "t027d-cap-a");
    const guestB = await createIntegrationUser(app, emailSender, db, "t027d-cap-b");
    const draft = await request(app)
      .post("/v1/me/activities")
      .set("Authorization", `Bearer ${host.accessToken}`)
      .send({
        title: "Capacity floor",
        category: "biking",
        ...futureWindow(),
        timeZone: "America/New_York",
        mode: "VIRTUAL",
        virtualMeetingDetails: "https://example.com/room",
        capacity: 3,
      });
    const activityId = draft.body.data.activityId as string;
    await request(app)
      .post(`/v1/me/activities/${activityId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${guestA.accessToken}`);
    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${guestB.accessToken}`);

    const patch = await request(app)
      .patch(`/v1/me/activities/${activityId}`)
      .set("Authorization", `Bearer ${host.accessToken}`)
      .send({ capacity: 1 });
    expect(patch.status).toBe(409);
  });
});
