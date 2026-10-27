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
import {
  createCapturingEmailSender,
  extractEmailChangeTokenFromText,
  extractVerificationTokenFromText,
} from "../helpers/capturing-email-sender.js";
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";

const defaultConsents = [
  { type: "TERMS", version: "pending-legal-review" },
  { type: "PRIVACY", version: "pending-legal-review" },
  { type: "AGE_ATTESTATION", version: "pending-legal-review" },
];

async function verifiedUser(
  app: ReturnType<typeof createApp>,
  emailSender: ReturnType<typeof createCapturingEmailSender>,
  db: DatabaseClient,
  prefix: string,
  options?: { kyc?: "APPROVED" | "PENDING" | "REJECTED" | "NOT_STARTED" },
): Promise<{ accessToken: string; userId: string; email: string; refreshToken: string }> {
  const email = `${prefix}-${Date.now()}@example.com`;
  const register = await request(app).post("/v1/auth/register").send({
    firstName: "Set",
    lastName: "User",
    email,
    password: "ValidPass1",
    dateOfBirth: "1995-06-15",
    consents: defaultConsents,
  });
  expect(register.status).toBe(201);
  const token = extractVerificationTokenFromText(emailSender.lastMessage?.text ?? "");
  expect(token).toBeTruthy();
  const confirm = await request(app).post("/v1/auth/email-verification/confirm").send({ token });
  expect(confirm.status).toBe(200);
  const login = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
  expect(login.status).toBe(200);
  const userId = login.body.data.user.id as string;
  if (options?.kyc && options.kyc !== "NOT_STARTED") {
    await db.user.update({
      where: { id: userId },
      data: { identityVerificationStatus: options.kyc },
    });
  }
  return {
    accessToken: login.body.data.accessToken as string,
    refreshToken: login.body.data.refreshToken as string,
    userId,
    email,
  };
}

function futureWindow(hoursFromNow = 48): { startsAt: string; endsAt: string } {
  const starts = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const ends = new Date(starts.getTime() + 2 * 60 * 60 * 1000);
  return { startsAt: starts.toISOString(), endsAt: ends.toISOString() };
}

async function publishActivity(
  app: ReturnType<typeof createApp>,
  hostToken: string,
): Promise<string> {
  const schedule = futureWindow();
  const draft = await request(app)
    .post("/v1/me/activities")
    .set("Authorization", `Bearer ${hostToken}`)
    .send({
      title: "Saved target ride",
      category: "biking",
      ...schedule,
      timeZone: "America/New_York",
      mode: "IN_PERSON",
      venueName: "Park",
      locationCity: "Miami",
      locationRegion: "FL",
      meetingInstructions: "Secret gate code 9999",
      capacity: 5,
      waitlistEnabled: false,
    });
  expect(draft.status).toBe(201);
  const activityId = draft.body.data.activityId as string;
  const publish = await request(app)
    .post(`/v1/me/activities/${activityId}/publish`)
    .set("Authorization", `Bearer ${hostToken}`);
  expect(publish.status).toBe(200);
  return activityId;
}

const describeSettings = runIntegration ? describe : describe.skip;

describeSettings("integration: settings & saved activities (Task 015)", () => {
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

  it("T015-P01 settings overview returns honest capabilities and counts", async () => {
    const user = await verifiedUser(app, emailSender, db, "t015-overview");
    const res = await request(app)
      .get("/v1/me/settings/overview")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.capabilities.twoFactorAuth).toBe("DEFERRED");
    expect(res.body.data.capabilities.accountDeletion).toBe("UNAVAILABLE");
    expect(res.body.data.account.email).toBe(user.email);
    expect(res.body.data.counts.activeSessions).toBeGreaterThanOrEqual(1);
  });

  it("T015-P02 saved activity is distinct from RSVP and omits meeting instructions", async () => {
    const host = await verifiedUser(app, emailSender, db, "t015-host", { kyc: "APPROVED" });
    const viewer = await verifiedUser(app, emailSender, db, "t015-viewer");
    const activityId = await publishActivity(app, host.accessToken);

    const save = await request(app)
      .put(`/v1/me/saved-activities/${activityId}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(save.status).toBe(200);
    expect(save.body.data.saved).toBe(true);

    const list = await request(app)
      .get("/v1/me/saved-activities")
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.activities).toHaveLength(1);
    expect(list.body.data.activities[0].activity.activityId).toBe(activityId);
    expect(list.body.data.activities[0].activity).not.toHaveProperty("meetingInstructions");

    const rsvp = await request(app)
      .post(`/v1/activities/${activityId}/rsvp`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(rsvp.status).toBe(403);

    const overview = await request(app)
      .get("/v1/me/settings/overview")
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(overview.body.data.counts.savedActivities).toBe(1);
    expect(overview.body.data.counts.confirmedUpcomingRsvps).toBe(0);
  });

  it("T015-P03 blocked host saved activity hidden from list", async () => {
    const host = await verifiedUser(app, emailSender, db, "t015-block-host", { kyc: "APPROVED" });
    const viewer = await verifiedUser(app, emailSender, db, "t015-block-viewer");
    const activityId = await publishActivity(app, host.accessToken);

    await request(app)
      .put(`/v1/me/saved-activities/${activityId}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .expect(200);

    await request(app)
      .post("/v1/me/blocks")
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .send({ targetUserId: host.userId })
      .expect(200);

    const list = await request(app)
      .get("/v1/me/saved-activities")
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.activities).toHaveLength(0);
  });

  it("T015-P04 email change two-phase flow revokes sessions", async () => {
    const user = await verifiedUser(app, emailSender, db, "t015-email");
    const newEmail = `t015-new-${Date.now()}@example.com`;

    emailSender.clear();
    const reqChange = await request(app)
      .post("/v1/me/email-change/request")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ newEmail, currentPassword: "ValidPass1" });
    expect(reqChange.status).toBe(202);
    expect(reqChange.body.data.emailDelivery).toBe("DEV_ONLY");

    const changeToken = extractEmailChangeTokenFromText(emailSender.lastMessage?.text ?? "");
    expect(changeToken).toBeTruthy();

    const confirm = await request(app)
      .post("/v1/me/email-change/confirm")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ token: changeToken });
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.sessionsRevoked).toBe(true);

    const account = await request(app)
      .get("/v1/me/account")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(account.status).toBe(401);

    const loginOld = await request(app)
      .post("/v1/auth/login")
      .send({ email: user.email, password: "ValidPass1" });
    expect(loginOld.status).toBe(401);

    const loginNew = await request(app)
      .post("/v1/auth/login")
      .send({ email: newEmail.toLowerCase(), password: "ValidPass1" });
    expect(loginNew.status).toBe(200);
  });

  it("T015-P05 session inventory and per-session revoke", async () => {
    const user = await verifiedUser(app, emailSender, db, "t015-sessions");
    await request(app).post("/v1/auth/login").send({ email: user.email, password: "ValidPass1" });

    const list = await request(app)
      .get("/v1/me/security/sessions")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.sessions.length).toBeGreaterThanOrEqual(2);
    const other = list.body.data.sessions.find((s: { isCurrent: boolean }) => !s.isCurrent);
    expect(other).toBeTruthy();

    const revoke = await request(app)
      .delete(`/v1/me/security/sessions/${other.sessionId}`)
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(revoke.status).toBe(200);
    expect(revoke.body.data.revoked).toBe(true);
  });

  it("T015-P06 account deletion impact is non-destructive", async () => {
    const user = await verifiedUser(app, emailSender, db, "t015-delete-impact");
    const res = await request(app)
      .get("/v1/me/account-deletion/impact")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.deletion.status).toBe("AWAITING_POLICY");
    expect(res.body.data.deletion.destructiveEndpointAvailable).toBe(false);
  });

  it("T015-N01 cross-user session revoke is idempotent no-op", async () => {
    const a = await verifiedUser(app, emailSender, db, "t015-sess-a");
    const b = await verifiedUser(app, emailSender, db, "t015-sess-b");
    const listA = await request(app)
      .get("/v1/me/security/sessions")
      .set("Authorization", `Bearer ${a.accessToken}`);
    const sessionId = listA.body.data.sessions[0].sessionId as string;

    const attack = await request(app)
      .delete(`/v1/me/security/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(attack.status).toBe(200);
    expect(attack.body.data.revoked).toBe(false);

    const stillValid = await request(app)
      .get("/v1/me/account")
      .set("Authorization", `Bearer ${a.accessToken}`);
    expect(stillValid.status).toBe(200);
  });
});
