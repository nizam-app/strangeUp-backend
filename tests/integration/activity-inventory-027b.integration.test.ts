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

describe.runIf(runIntegration)("Task 027B activity inventory (Neon)", () => {
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

  it("T027B-01 upcoming inventory merges hosting and joined without duplicates or meeting fields", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027b-host");
    const guest = await createIntegrationUser(app, emailSender, db, "t027b-guest");

    const activityPayload = (schedule: { startsAt: string; endsAt: string }, title: string) => ({
      title,
      category: "biking",
      ...schedule,
      timeZone: "America/New_York",
      mode: "IN_PERSON",
      venueName: "Bayfront Park",
      locationCity: "Miami",
      locationRegion: "FL",
      meetingInstructions: "Main entrance",
      capacity: 8,
      waitlistEnabled: true,
    });

    const hostSchedule = futureWindow(72);
    const hosted = await request(app)
      .post("/v1/me/activities")
      .set("Authorization", `Bearer ${host.accessToken}`)
      .send(activityPayload(hostSchedule, "Host ride"));
    expect(hosted.status).toBe(201);
    const publishHost = await request(app)
      .post(`/v1/me/activities/${hosted.body.data.activityId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(publishHost.status).toBe(200);

    const joinSchedule = futureWindow(96);
    const joinedActivity = await request(app)
      .post("/v1/me/activities")
      .set("Authorization", `Bearer ${guest.accessToken}`)
      .send(activityPayload(joinSchedule, "Guest ride"));
    expect(joinedActivity.status).toBe(201);
    const joinedId = joinedActivity.body.data.activityId as string;
    const publishGuest = await request(app)
      .post(`/v1/me/activities/${joinedId}/publish`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(publishGuest.status).toBe(200);
    const joinHost = await request(app)
      .post(`/v1/activities/${joinedId}/rsvp`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(joinHost.status).toBe(200);
    expect(joinHost.body.data.state).toBe("CONFIRMED");

    const inventory = await request(app)
      .get("/v1/me/activity-inventory")
      .query({ view: "upcoming", includeCounts: "true" })
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(inventory.status).toBe(200);
    const items = inventory.body.data.items as Array<{
      relationship: string;
      activity: { activityId: string };
    }>;
    const ids = items.map((item) => item.activity.activityId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(hosted.body.data.activityId);
    expect(ids).toContain(joinedId);
    expect(inventory.body.data.counts.upcoming).toBeGreaterThanOrEqual(2);
    for (const item of items) {
      expect(publicActivityDtoContainsSensitiveKeys(item.activity)).toBe(false);
      expect(item).not.toHaveProperty("meetingInstructions");
    }
  });

  it("T027B-02 waitlisted and joined views preserve participation states", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027b-wl-host");
    const confirmed = await createIntegrationUser(app, emailSender, db, "t027b-wl-conf");
    const waitlisted = await createIntegrationUser(app, emailSender, db, "t027b-wl-wait");

    const schedule = futureWindow(80);
    const draft = await request(app)
      .post("/v1/me/activities")
      .set("Authorization", `Bearer ${host.accessToken}`)
      .send({
        title: "Small table",
        category: "running",
        ...schedule,
        timeZone: "America/New_York",
        mode: "IN_PERSON",
        venueName: "Track",
        locationCity: "Miami",
        locationRegion: "FL",
        meetingInstructions: "Gate A",
        capacity: 1,
        waitlistEnabled: true,
      });
    const activityId = draft.body.data.activityId as string;
    const publish = await request(app)
      .post(`/v1/me/activities/${activityId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(publish.status).toBe(200);

    const confirmJoin = await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${confirmed.accessToken}`);
    expect(confirmJoin.status).toBe(200);
    expect(confirmJoin.body.data.state).toBe("CONFIRMED");

    const waitJoin = await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${waitlisted.accessToken}`);
    expect(waitJoin.status).toBe(200);
    expect(waitJoin.body.data.state).toBe("WAITLISTED");

    const joined = await request(app)
      .get("/v1/me/activity-rsvps")
      .query({ participation: "confirmed", when: "upcoming" })
      .set("Authorization", `Bearer ${confirmed.accessToken}`);
    expect(joined.status).toBe(200);
    expect(joined.body.data.rsvps[0].myParticipation.state).toBe("CONFIRMED");

    const waitlist = await request(app)
      .get("/v1/me/activity-inventory")
      .query({ view: "waitlisted" })
      .set("Authorization", `Bearer ${waitlisted.accessToken}`);
    expect(waitlist.status).toBe(200);
    expect(waitlist.body.data.items[0].relationship).toBe("WAITLISTED");
    expect(waitlist.body.data.items[0].myParticipation.state).toBe("WAITLISTED");
  });
});
