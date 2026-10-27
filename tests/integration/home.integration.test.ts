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
  options?: { kyc?: "APPROVED"; visibility?: "EVERYONE" | "VERIFIED_USERS_ONLY" },
): Promise<{ accessToken: string; userId: string; email: string }> {
  const email = `${prefix}-${Date.now()}@example.com`;
  const register = await request(app).post("/v1/auth/register").send({
    firstName: "Home",
    lastName: "User",
    email,
    password: "ValidPass1",
    dateOfBirth: "1995-06-15",
    consents: defaultConsents,
  });
  expect(register.status).toBe(201);
  const token = extractVerificationTokenFromText(emailSender.lastMessage?.text ?? "");
  const confirm = await request(app).post("/v1/auth/email-verification/confirm").send({ token });
  expect(confirm.status).toBe(200);
  const login = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
  expect(login.status).toBe(200);
  const userId = login.body.data.user.id as string;
  if (options?.visibility) {
    await db.profile.update({
      where: { userId },
      data: { profileVisibility: options.visibility },
    });
  }
  if (options?.kyc === "APPROVED") {
    await db.user.update({
      where: { id: userId },
      data: { identityVerificationStatus: "APPROVED" },
    });
  }
  return { accessToken: login.body.data.accessToken as string, userId, email };
}

const describeHome = runIntegration ? describe : describe.skip;

describeHome("integration: home dashboard, feed & notifications (Task 013)", () => {
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
      GROUP_UPLOAD_DIR: ".data/test-group-media",
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

  it("T013-H01 home dashboard returns bounded sections and deferred stories", async () => {
    const user = await verifiedUser(app, emailSender, db, "t013-h01");
    const res = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.stories.status).toBe("DEFERRED");
    expect(Array.isArray(res.body.data.myGroups)).toBe(true);
    expect(Array.isArray(res.body.data.communityFeedPreview)).toBe(true);
    expect(res.body.data).not.toHaveProperty("distanceMiles");
    expect(typeof res.body.data.notificationsUnreadCount).toBe("number");
  });

  it("T013-H02 community feed aggregates member-group posts; blocks revoked membership", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t013-h02o");
    const member = await verifiedUser(app, emailSender, db, "t013-h02m");

    const group = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Feed Group", category: "social", privacy: "PUBLIC" });
    expect(group.status).toBe(201);
    const groupId = group.body.data.groupId as string;

    await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);

    await request(app)
      .post(`/v1/groups/${groupId}/posts`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ body: "Hello feed" });

    const feed = await request(app)
      .get("/v1/me/community-feed")
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(feed.status).toBe(200);
    expect(feed.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(feed.body.data.items[0].body).toBe("Hello feed");
    expect(feed.body.data.items[0]).not.toHaveProperty("meetingInstructions");

    await request(app)
      .delete(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);

    const afterLeave = await request(app)
      .get("/v1/me/community-feed")
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(afterLeave.status).toBe(200);
    expect(afterLeave.body.data.items).toHaveLength(0);
  });

  it("T013-H03 notifications: message request, read isolation, dedupe and mark-all", async () => {
    const sender = await verifiedUser(app, emailSender, db, "t013-h03s", {
      visibility: "EVERYONE",
    });
    const recipient = await verifiedUser(app, emailSender, db, "t013-h03r", {
      visibility: "EVERYONE",
    });

    await request(app)
      .post("/v1/me/message-requests")
      .set("Authorization", `Bearer ${sender.accessToken}`)
      .send({ targetUserId: recipient.userId });

    const inbox = await request(app)
      .get("/v1/me/notifications")
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(inbox.status).toBe(200);
    expect(inbox.body.data.unreadCount).toBeGreaterThanOrEqual(1);
    const notificationId = inbox.body.data.notifications[0].notificationId as string;

    const other = await verifiedUser(app, emailSender, db, "t013-h03x");
    const steal = await request(app)
      .post(`/v1/me/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${other.accessToken}`);
    expect(steal.status).toBe(404);

    const read = await request(app)
      .post(`/v1/me/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(read.status).toBe(200);
    expect(read.body.data.read).toBe(true);

    const readAgain = await request(app)
      .post(`/v1/me/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(readAgain.status).toBe(200);
    expect(readAgain.body.data.read).toBe(true);

    await request(app)
      .post("/v1/me/notifications/read-all")
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    const home = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${recipient.accessToken}`);
    expect(home.body.data.notificationsUnreadCount).toBe(0);
  });

  it("T013-H04 group membership approval emits notification", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t013-h04o");
    const applicant = await verifiedUser(app, emailSender, db, "t013-h04a");

    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Private Feed", category: "social", privacy: "PRIVATE_APPROVAL" });
    const groupId = created.body.data.groupId as string;

    await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${applicant.accessToken}`);

    const requests = await request(app)
      .get(`/v1/me/groups/${groupId}/join-requests`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    const memberId = requests.body.data.requests[0].membershipId as string;

    await request(app)
      .post(`/v1/me/groups/${groupId}/join-requests/${memberId}/approve`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    const notes = await request(app)
      .get("/v1/me/notifications")
      .set("Authorization", `Bearer ${applicant.accessToken}`);
    expect(notes.status).toBe(200);
    expect(
      notes.body.data.notifications.some(
        (n: { type: string }) => n.type === "GROUP_MEMBERSHIP_APPROVED",
      ),
    ).toBe(true);
  });
});
