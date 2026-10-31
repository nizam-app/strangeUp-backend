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
    capacity: 1,
    waitlistEnabled: true,
    joinMode: "HOST_APPROVAL" as const,
    ...extra,
  };
}

async function publishHostApprovalActivity(
  app: ReturnType<typeof createApp>,
  hostToken: string,
  title: string,
  extra = {},
) {
  const schedule = futureWindow(90);
  const draft = await request(app)
    .post("/v1/me/activities")
    .set("Authorization", `Bearer ${hostToken}`)
    .send(inPersonDraft(title, schedule, extra));
  expect(draft.status).toBe(201);
  const activityId = draft.body.data.activityId as string;
  await request(app)
    .post(`/v1/me/activities/${activityId}/publish`)
    .set("Authorization", `Bearer ${hostToken}`)
    .expect(200);
  return activityId;
}

describe.runIf(runIntegration)("Task 027E security regression (Neon)", () => {
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

  it("T027E-SEC-01 concurrent host approvals cannot overbook final seat", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027e-sec-conc-host");
    const a = await createIntegrationUser(app, emailSender, db, "t027e-sec-conc-a");
    const b = await createIntegrationUser(app, emailSender, db, "t027e-sec-conc-b");
    const activityId = await publishHostApprovalActivity(app, host.accessToken, "Concurrent cap");

    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${a.accessToken}`)
      .expect(200);
    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${b.accessToken}`)
      .expect(200);

    const [approveA, approveB] = await Promise.all([
      request(app)
        .post(`/v1/me/activities/${activityId}/join-requests/${a.userId}/approve`)
        .set("Authorization", `Bearer ${host.accessToken}`),
      request(app)
        .post(`/v1/me/activities/${activityId}/join-requests/${b.userId}/approve`)
        .set("Authorization", `Bearer ${host.accessToken}`),
    ]);
    expect(approveA.status).toBe(200);
    expect(approveB.status).toBe(200);

    const confirmedCount = await db.activityParticipation.count({
      where: { activityId, state: "CONFIRMED" },
    });
    expect(confirmedCount).toBe(1);

    const states = await db.activityParticipation.findMany({
      where: { activityId, userId: { in: [a.userId, b.userId] } },
      select: { userId: true, state: true, hostApprovedAt: true },
    });
    const confirmedUsers = states.filter((row) => row.state === "CONFIRMED");
    const waitlistedUsers = states.filter((row) => row.state === "WAITLISTED");
    expect(confirmedUsers).toHaveLength(1);
    expect(waitlistedUsers).toHaveLength(1);
    expect(waitlistedUsers[0].hostApprovedAt).not.toBeNull();
  });

  it("T027E-SEC-02 duplicate approve is idempotent; decline blocks re-approve", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027e-sec-idem-host");
    const guest = await createIntegrationUser(app, emailSender, db, "t027e-sec-idem-guest");
    const activityId = await publishHostApprovalActivity(app, host.accessToken, "Idempotent");

    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${guest.accessToken}`)
      .expect(200);

    const first = await request(app)
      .post(`/v1/me/activities/${activityId}/join-requests/${guest.userId}/approve`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(first.status).toBe(200);
    expect(first.body.data.state).toBe("CONFIRMED");

    const second = await request(app)
      .post(`/v1/me/activities/${activityId}/join-requests/${guest.userId}/approve`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(second.status).toBe(200);
    expect(second.body.data.state).toBe("CONFIRMED");

    await request(app)
      .post(`/v1/me/activities/${activityId}/join-requests/${guest.userId}/decline`)
      .set("Authorization", `Bearer ${host.accessToken}`)
      .expect(409);
  });

  it("T027E-SEC-03 DECLINED participant cannot access meeting instructions", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027e-sec-dec-host");
    const guest = await createIntegrationUser(app, emailSender, db, "t027e-sec-dec-guest");
    const activityId = await publishHostApprovalActivity(app, host.accessToken, "Declined meeting");

    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${guest.accessToken}`)
      .expect(200);
    await request(app)
      .post(`/v1/me/activities/${activityId}/join-requests/${guest.userId}/decline`)
      .set("Authorization", `Bearer ${host.accessToken}`)
      .expect(200);

    const meeting = await request(app)
      .get(`/v1/activities/${activityId}/meeting`)
      .set("Authorization", `Bearer ${guest.accessToken}`);
    expect(meeting.status).toBe(403);
  });

  it("T027E-SEC-04 block and KYC revocation block host approval", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027e-sec-elig-host");
    const blocked = await createIntegrationUser(app, emailSender, db, "t027e-sec-block-guest");
    const revoked = await createIntegrationUser(app, emailSender, db, "t027e-sec-kyc-guest");
    const activityId = await publishHostApprovalActivity(app, host.accessToken, "Eligibility", {
      capacity: 4,
    });

    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${blocked.accessToken}`)
      .expect(200);
    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${revoked.accessToken}`)
      .expect(200);

    await request(app)
      .post("/v1/me/blocks")
      .set("Authorization", `Bearer ${host.accessToken}`)
      .send({ targetUserId: blocked.userId });

    const blockApprove = await request(app)
      .post(`/v1/me/activities/${activityId}/join-requests/${blocked.userId}/approve`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(blockApprove.status).toBe(409);

    await db.user.update({
      where: { id: revoked.userId },
      data: { identityVerificationRevokedAt: new Date() },
    });

    const kycApprove = await request(app)
      .post(`/v1/me/activities/${activityId}/join-requests/${revoked.userId}/approve`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect(kycApprove.status).toBe(409);
  });

  it("T027E-SEC-05 approved waitlist FIFO promotes on confirmed leave (HOST_APPROVAL)", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027e-sec-fifo-host");
    const first = await createIntegrationUser(app, emailSender, db, "t027e-sec-fifo-a");
    const second = await createIntegrationUser(app, emailSender, db, "t027e-sec-fifo-b");
    const activityId = await publishHostApprovalActivity(app, host.accessToken, "Fifo promote");

    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${first.accessToken}`)
      .expect(200);
    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${second.accessToken}`)
      .expect(200);

    await request(app)
      .post(`/v1/me/activities/${activityId}/join-requests/${first.userId}/approve`)
      .set("Authorization", `Bearer ${host.accessToken}`)
      .expect(200);
    await request(app)
      .post(`/v1/me/activities/${activityId}/join-requests/${second.userId}/approve`)
      .set("Authorization", `Bearer ${host.accessToken}`)
      .expect(200);

    const beforeLeave = await db.activityParticipation.findUnique({
      where: { activityId_userId: { activityId, userId: second.userId } },
    });
    expect(beforeLeave?.state).toBe("WAITLISTED");

    const leave = await request(app)
      .delete(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${first.accessToken}`);
    expect(leave.status).toBe(200);
    expect(leave.body.data.promoted).toBe(true);

    const after = await db.activityParticipation.findUnique({
      where: { activityId_userId: { activityId, userId: second.userId } },
    });
    expect(after?.state).toBe("CONFIRMED");
  });

  it("T027E-SEC-06 draft omits joinMode → published AUTO (migration default parity)", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027e-sec-auto-default");
    const schedule = futureWindow(100);
    const draft = await request(app)
      .post("/v1/me/activities")
      .set("Authorization", `Bearer ${host.accessToken}`)
      .send({
        title: "Default mode",
        category: "biking",
        ...schedule,
        timeZone: "America/New_York",
        mode: "IN_PERSON",
        venueName: "Park",
        locationCity: "Miami",
        meetingInstructions: "Gate",
        capacity: 5,
      });
    expect(draft.status).toBe(201);
    expect(draft.body.data.joinMode).toBe("AUTO");
    const activityId = draft.body.data.activityId as string;
    const row = await db.activity.findUnique({
      where: { id: activityId },
      select: { joinMode: true },
    });
    expect(row?.joinMode).toBe("AUTO");
  });

  it("T027E-SEC-08 suspended host cannot approve join requests", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027e-sec-susp-host");
    const guest = await createIntegrationUser(app, emailSender, db, "t027e-sec-susp-guest");
    const activityId = await publishHostApprovalActivity(app, host.accessToken, "Suspended host");

    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${guest.accessToken}`)
      .expect(200);

    await db.user.update({
      where: { id: host.userId },
      data: { suspendedAt: new Date(), accountStatus: "SUSPENDED" },
    });

    const approve = await request(app)
      .post(`/v1/me/activities/${activityId}/join-requests/${guest.userId}/approve`)
      .set("Authorization", `Bearer ${host.accessToken}`);
    expect([401, 403]).toContain(approve.status);
  });

  it("T027E-SEC-07 withdraw vs approve race leaves a single terminal participation row", async () => {
    const host = await createIntegrationUser(app, emailSender, db, "t027e-sec-race-host");
    const guest = await createIntegrationUser(app, emailSender, db, "t027e-sec-race-guest");
    const activityId = await publishHostApprovalActivity(app, host.accessToken, "Race");

    await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${guest.accessToken}`)
      .expect(200);

    await Promise.all([
      request(app)
        .post(`/v1/me/activities/${activityId}/join-requests/${guest.userId}/approve`)
        .set("Authorization", `Bearer ${host.accessToken}`),
      request(app)
        .delete(`/v1/activities/${activityId}/rsvp`)
        .set("Authorization", `Bearer ${guest.accessToken}`),
    ]);

    const row = await db.activityParticipation.findUnique({
      where: { activityId_userId: { activityId, userId: guest.userId } },
    });
    expect(row).not.toBeNull();
    expect(["CONFIRMED", "CANCELLED"]).toContain(row!.state);
    const confirmedCount = await db.activityParticipation.count({
      where: { activityId, state: "CONFIRMED" },
    });
    expect(confirmedCount).toBeLessThanOrEqual(1);
  });
});
