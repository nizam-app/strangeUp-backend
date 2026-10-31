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

async function publishInPersonActivity(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  title: string,
) {
  const schedule = futureWindow();
  const draft = await request(app)
    .post("/v1/me/activities")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      title,
      category: "biking",
      ...schedule,
      timeZone: "America/New_York",
      mode: "IN_PERSON",
      venueName: "Bayfront Park",
      locationCity: "Miami",
      locationRegion: "FL",
      meetingInstructions: "Meet at the south fountain",
      capacity: 4,
      waitlistEnabled: true,
    });
  expect(draft.status).toBe(201);
  const activityId = draft.body.data.activityId as string;
  const publish = await request(app)
    .post(`/v1/me/activities/${activityId}/publish`)
    .set("Authorization", `Bearer ${accessToken}`);
  expect(publish.status).toBe(200);
  return activityId;
}

describe.runIf(runIntegration)("Task 027C activity privacy (Neon)", () => {
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

  it("T027C-P01 host deactivation conceals detail/cover/meeting/new RSVP; leave and inventory RSVP persist", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027c-host");
    const guest = await createIntegrationUser(app, emailSender, db, "t027c-guest");
    const outsider = await createIntegrationUser(app, emailSender, db, "t027c-outsider");

    const activityId = await publishInPersonActivity(
      app,
      host.accessToken,
      "Revocation parity ride",
    );

    const join = await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(join.status).toBe(200);
    expect(join.body.data.state).toBe("CONFIRMED");

    const meetingBefore = await request(app)
      .get(`/v1/activities/${activityId}/meeting`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(meetingBefore.status).toBe(200);

    await db.user.update({
      where: { id: host.userId },
      data: { adminReviewStatus: "PENDING", adminReviewVerificationSessionId: null },
    });

    expect(
      (
        await request(app)
          .get(`/v1/activities/${activityId}`)
          .set("Authorization", `Bearer ${guest.accessToken}`)
      ).status,
    ).toBe(404);

    expect(
      (
        await request(app)
          .get(`/v1/activities/${activityId}/cover`)
          .set("Authorization", `Bearer ${guest.accessToken}`)
      ).status,
    ).toBe(404);

    expect(
      (
        await request(app)
          .get(`/v1/activities/${activityId}/meeting`)
          .set("Authorization", `Bearer ${guest.accessToken}`)
      ).status,
    ).toBe(404);

    expect(
      (
        await request(app)
          .post(`/v1/activities/${activityId}/rsvp`)
          .set("Authorization", `Bearer ${outsider.accessToken}`)
      ).status,
    ).toBe(404);

    const inventory = await request(app)
      .get("/v1/me/activity-inventory")
      .query({ view: "joined", includeCounts: "true" })
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(inventory.status).toBe(200);
    expect(
      inventory.body.data.items.some(
        (item: { activity: { activityId: string } }) => item.activity.activityId === activityId,
      ),
    ).toBe(true);
    expect(inventory.body.data.items[0].activity.host.displayName).toBeNull();
    expect(inventory.body.data.counts.joined).toBeGreaterThanOrEqual(1);

    const leave = await request(app)
      .delete(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(leave.status).toBe(200);

    expect(
      (
        await request(app)
          .get(`/v1/activities/${activityId}/meeting`)
          .set("Authorization", `Bearer ${host.accessToken}`)
      ).status,
    ).toBe(403);
  });

  it("T027C-P02 participant KYC revocation denies meeting but preserves CONFIRMED participation", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027c-kyc-host");
    const guest = await createIntegrationUser(app, emailSender, db, "t027c-kyc-guest");
    const activityId = await publishInPersonActivity(
      app,
      host.accessToken,
      "KYC meeting gate ride",
    );

    expect(
      (
        await request(app)
          .post(`/v1/activities/${activityId}/rsvp`)
          .set("Authorization", `Bearer ${guest.accessToken}`)
      ).status,
    ).toBe(200);

    await db.user.update({
      where: { id: guest.userId },
      data: {
        identityVerificationValidUntil: new Date(Date.now() - 3_600_000),
      },
    });

    expect(
      (
        await request(app)
          .get(`/v1/activities/${activityId}`)
          .set("Authorization", `Bearer ${guest.accessToken}`)
      ).status,
    ).toBe(403);

    const meeting = await request(app)
      .get(`/v1/activities/${activityId}/meeting`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(meeting.status).toBe(403);

    const participation = await db.activityParticipation.findUnique({
      where: { activityId_userId: { activityId, userId: guest.userId } },
    });
    expect(participation?.state).toBe("CONFIRMED");
  });

  it("T027C-P03 inventory upcoming regression (027B) still omits meeting fields", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027c-inv-host");
    const activityId = await publishInPersonActivity(
      app,
      host.accessToken,
      "Inventory privacy ride",
    );

    const inventory = await request(app)
      .get("/v1/me/activity-inventory")
      .query({ view: "hosting" })
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(inventory.status).toBe(200);
    const row = inventory.body.data.items.find(
      (item: { activity: { activityId: string } }) => item.activity.activityId === activityId,
    );
    expect(row).toBeTruthy();
    expect(row.activity.confirmedCount).toBe(0);
    expect(row.activity).not.toHaveProperty("meetingInstructions");
  });
});
