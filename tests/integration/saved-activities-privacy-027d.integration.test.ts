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

function futureWindow(): { startsAt: string; endsAt: string } {
  const starts = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const ends = new Date(starts.getTime() + 2 * 60 * 60 * 1000);
  return { startsAt: starts.toISOString(), endsAt: ends.toISOString() };
}

describe.runIf(runIntegration)("Task 027D saved activities privacy (Neon)", () => {
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

  it("T027D-S01 conceals saved activities when host loses activation; DB row preserved", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027d-save-host");
    const viewer = await createIntegrationUser(app, emailSender, db, "t027d-save-viewer");
    const schedule = futureWindow();
    const draft = await request(app)
      .post("/v1/me/activities")
      .set("Authorization", `Bearer ${host.accessToken}`)
      .send({
        title: "Saved conceal ride",
        category: "biking",
        ...schedule,
        timeZone: "America/New_York",
        mode: "IN_PERSON",
        venueName: "Park",
        locationCity: "Miami",
        locationRegion: "FL",
        meetingInstructions: "Gate 2",
        capacity: 5,
      });
    const activityId = draft.body.data.activityId as string;
    await request(app)
      .post(`/v1/me/activities/${activityId}/publish`)
      .set("Authorization", `Bearer ${host.accessToken}`);

    expect(
      (
        await request(app)
          .put(`/v1/me/saved-activities/${activityId}`)
          .set("Authorization", `Bearer ${viewer.accessToken}`)
      ).status,
    ).toBe(200);

    await db.user.update({
      where: { id: host.userId },
      data: { adminReviewStatus: "PENDING", adminReviewVerificationSessionId: null },
    });

    const list = await request(app)
      .get("/v1/me/saved-activities")
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.activities).toHaveLength(0);

    const saveAgain = await request(app)
      .put(`/v1/me/saved-activities/${activityId}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(saveAgain.status).toBe(404);

    const savedRow = await db.savedActivity.findUnique({
      where: { userId_activityId: { userId: viewer.userId, activityId } },
    });
    expect(savedRow).not.toBeNull();
  });
});
