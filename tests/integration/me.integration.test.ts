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
  extractPasswordResetTokenFromText,
  extractVerificationTokenFromText,
} from "../helpers/capturing-email-sender.js";
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";

const defaultConsents = [
  { type: "TERMS", version: "pending-legal-review" },
  { type: "PRIVACY", version: "pending-legal-review" },
  { type: "AGE_ATTESTATION", version: "pending-legal-review" },
];

function registerPayload(email: string, dateOfBirth = "1995-06-15") {
  return {
    firstName: "Test",
    lastName: "User",
    email,
    password: "ValidPass1",
    dateOfBirth,
    consents: defaultConsents,
  };
}

async function loginUser(
  app: ReturnType<typeof createApp>,
  email: string,
  password = "ValidPass1",
): Promise<{ accessToken: string; refreshToken: string }> {
  const login = await request(app).post("/v1/auth/login").send({ email, password });
  expect(login.status).toBe(200);
  return {
    accessToken: login.body.data.accessToken as string,
    refreshToken: login.body.data.refreshToken as string,
  };
}

async function verifyEmail(
  app: ReturnType<typeof createApp>,
  emailSender: ReturnType<typeof createCapturingEmailSender>,
): Promise<void> {
  const token = extractVerificationTokenFromText(emailSender.lastMessage?.text ?? "");
  expect(token).toBeTruthy();
  const confirm = await request(app).post("/v1/auth/email-verification/confirm").send({ token });
  expect(confirm.status).toBe(200);
}

const describeMe = runIntegration ? describe : describe.skip;

describeMe("integration: password reset and /v1/me", () => {
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
    });
    app = createApp({
      env,
      logger: pino({ level: "silent" }),
      db,
      emailSender,
    });
  });

  beforeEach(async () => {
    clearRateLimits();
    emailSender.clear();
    await db.$executeRawUnsafe(`
      TRUNCATE TABLE
        "RegisterIdempotency",
        "AuthChallenge",
        "ConsentRecord",
        "UserInterest",
        "Session",
        "PasswordCredential",
        "Profile",
        "User"
      RESTART IDENTITY CASCADE;
    `);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("I-N05 password reset request returns same response for unknown email", async () => {
    const knownEmail = `known-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(knownEmail));

    const known = await request(app)
      .post("/v1/auth/password-reset/request")
      .send({ email: knownEmail });
    const unknown = await request(app)
      .post("/v1/auth/password-reset/request")
      .send({ email: `missing-${Date.now()}@example.com` });

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body.data.message).toBe(unknown.body.data.message);
    expect(known.body.data.token).toBeUndefined();
  });

  it("I-P06 password reset revokes sessions and allows login with new password", async () => {
    const email = `reset-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const before = await loginUser(app, email);

    await request(app).post("/v1/auth/password-reset/request").send({ email });
    const token = extractPasswordResetTokenFromText(emailSender.lastMessage?.text ?? "");
    expect(token).toBeTruthy();

    const confirm = await request(app)
      .post("/v1/auth/password-reset/confirm")
      .send({ token, newPassword: "NewValid2" });
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.accessToken).toBeUndefined();

    const oldLogin = await request(app)
      .post("/v1/auth/login")
      .send({ email, password: "ValidPass1" });
    expect(oldLogin.status).toBe(401);

    const refreshBlocked = await request(app)
      .post("/v1/auth/refresh")
      .send({ refreshToken: before.refreshToken });
    expect(refreshBlocked.status).toBe(401);

    const meBlocked = await request(app)
      .get("/v1/me/account")
      .set("Authorization", `Bearer ${before.accessToken}`);
    expect(meBlocked.status).toBe(401);

    const newLogin = await request(app)
      .post("/v1/auth/login")
      .send({ email, password: "NewValid2" });
    expect(newLogin.status).toBe(200);
  });

  it("I-N06 I-N07 reset token expired, reused, and wrong purpose rejected", async () => {
    const email = `reset2-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const verifyToken = extractVerificationTokenFromText(emailSender.lastMessage?.text ?? "");
    expect(verifyToken).toBeTruthy();
    await request(app).post("/v1/auth/password-reset/request").send({ email });
    const token = extractPasswordResetTokenFromText(emailSender.lastMessage?.text ?? "");
    expect(token).toBeTruthy();

    const wrongPurpose = await request(app)
      .post("/v1/auth/password-reset/confirm")
      .send({ token: verifyToken, newPassword: "NewValid2" });
    expect(wrongPurpose.status).toBe(400);

    const first = await request(app)
      .post("/v1/auth/password-reset/confirm")
      .send({ token, newPassword: "NewValid2" });
    expect(first.status).toBe(200);
    const second = await request(app)
      .post("/v1/auth/password-reset/confirm")
      .send({ token, newPassword: "NewValid3" });
    expect(second.status).toBe(400);

    const email2 = `reset3-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email2));
    await request(app).post("/v1/auth/password-reset/request").send({ email: email2 });
    const token2 = extractPasswordResetTokenFromText(emailSender.lastMessage?.text ?? "");
    const hash = await import("../../src/modules/auth/crypto.js").then((m) =>
      m.hashSha256(token2!),
    );
    await db.authChallenge.updateMany({
      data: { expiresAt: new Date(Date.now() - 60_000) },
      where: { secretHash: hash },
    });
    const expired = await request(app)
      .post("/v1/auth/password-reset/confirm")
      .send({ token: token2, newPassword: "NewValid2" });
    expect(expired.status).toBe(400);
  });

  it("I-C03 concurrent password reset confirm allows at most one success", async () => {
    const email = `race-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    await request(app).post("/v1/auth/password-reset/request").send({ email });
    const token = extractPasswordResetTokenFromText(emailSender.lastMessage?.text ?? "");
    expect(token).toBeTruthy();

    const [a, b] = await Promise.all([
      request(app)
        .post("/v1/auth/password-reset/confirm")
        .send({ token, newPassword: "NewValid2" }),
      request(app)
        .post("/v1/auth/password-reset/confirm")
        .send({ token, newPassword: "NewValid3" }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 400]);
  });

  it("pending user can GET /v1/me/account but cannot PATCH profile", async () => {
    const email = `pending-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const { accessToken } = await loginUser(app, email);

    const account = await request(app)
      .get("/v1/me/account")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(account.status).toBe(200);
    expect(account.body.data.accountStatus).toBe("ACTIVE");
    expect(account.body.data.emailVerified).toBe(false);
    expect(account.body.data.passwordHash).toBeUndefined();

    const profileGet = await request(app)
      .get("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(profileGet.status).toBe(200);

    const patch = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ bio: "Hello" });
    expect(patch.status).toBe(403);
  });

  it("I-P07 verified user can PATCH allowed profile fields only", async () => {
    const email = `profile-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    await verifyEmail(app, emailSender);
    const { accessToken } = await loginUser(app, email);

    const rejected = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ bio: "Hi", role: "admin", userId: "00000000-0000-0000-0000-000000000099" });
    expect(rejected.status).toBe(400);

    const patch = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ bio: "Hello world", scheduleTimeZone: "America/New_York" });
    expect(patch.status).toBe(200);
    expect(patch.body.data.bio).toBe("Hello world");
    expect(patch.body.data.passwordHash).toBeUndefined();

    const get = await request(app)
      .get("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(get.body.data.bio).toBe("Hello world");
    expect(get.body.data.birthDate).toBe("1995-06-15");

    const names = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ firstName: "Ada", lastName: "Lovelace" });
    expect(names.status).toBe(200);
    expect(names.body.data.firstName).toBe("Ada");
    expect(names.body.data.lastName).toBe("Lovelace");
  });

  it("rejects PATCH with birthDate and oversize bio", async () => {
    const email = `patch-guard-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    await verifyEmail(app, emailSender);
    const { accessToken } = await loginUser(app, email);

    const dob = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ birthDate: "2000-01-01" });
    expect(dob.status).toBe(400);

    const longBio = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ bio: "x".repeat(301) });
    expect(longBio.status).toBe(400);
  });

  it("T006-P01 verified user can set and read username", async () => {
    const email = `username-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    await verifyEmail(app, emailSender);
    const { accessToken } = await loginUser(app, email);

    const set = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ username: "alexmilo" });
    expect(set.status).toBe(200);
    expect(set.body.data.username).toBe("alexmilo");

    const get = await request(app)
      .get("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(get.body.data.username).toBe("alexmilo");
  });

  it("T006-N01 username validation and conflict handling", async () => {
    const emailA = `uname-a-${Date.now()}@example.com`;
    const emailB = `uname-b-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(emailA));
    await verifyEmail(app, emailSender);
    await request(app).post("/v1/auth/register").send(registerPayload(emailB));
    await verifyEmail(app, emailSender);
    const userA = await loginUser(app, emailA);
    const userB = await loginUser(app, emailB);

    const invalid = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({ username: "Bad-Name" });
    expect(invalid.status).toBe(400);

    const first = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({ username: "taken_handle" });
    expect(first.status).toBe(200);

    const conflict = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({ username: "taken_handle" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("CONFLICT");
  });

  it("T006-C01 concurrent username claim allows at most one success", async () => {
    const emailA = `uname-race-a-${Date.now()}@example.com`;
    const emailB = `uname-race-b-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(emailA));
    await verifyEmail(app, emailSender);
    await request(app).post("/v1/auth/register").send(registerPayload(emailB));
    await verifyEmail(app, emailSender);
    const userA = await loginUser(app, emailA);
    const userB = await loginUser(app, emailB);

    const [a, b] = await Promise.all([
      request(app)
        .patch("/v1/me/profile")
        .set("Authorization", `Bearer ${userA.accessToken}`)
        .send({ username: "race_handle" }),
      request(app)
        .patch("/v1/me/profile")
        .set("Authorization", `Bearer ${userB.accessToken}`)
        .send({ username: "race_handle" }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it("T006-P02 legacy bio over 300 is preserved on unrelated PATCH", async () => {
    const email = `legacy-bio-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    await verifyEmail(app, emailSender);
    const { accessToken } = await loginUser(app, email);

    const user = await db.user.findFirstOrThrow({
      where: { emailNormalized: email.toLowerCase() },
    });
    const legacyBio = "L".repeat(350);
    await db.profile.update({
      where: { userId: user.id },
      data: { bio: legacyBio },
    });

    const getBefore = await request(app)
      .get("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(getBefore.body.data.bio).toHaveLength(350);

    const patch = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ firstName: "Legacy" });
    expect(patch.status).toBe(200);
    expect(patch.body.data.bio).toHaveLength(350);
    expect(patch.body.data.firstName).toBe("Legacy");
  });

  it("T006-N02 pending user cannot set username", async () => {
    const email = `pending-uname-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const { accessToken } = await loginUser(app, email);

    const patch = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ username: "pending_user" });
    expect(patch.status).toBe(403);
  });

  it("T005-P01 authenticated password change revokes sessions and requires re-login", async () => {
    const email = `pwchange-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const before = await loginUser(app, email);
    const session2 = await loginUser(app, email);

    const change = await request(app)
      .post("/v1/me/password-change")
      .set("Authorization", `Bearer ${before.accessToken}`)
      .send({ currentPassword: "ValidPass1", newPassword: "NewValid2" });
    expect(change.status).toBe(200);
    expect(change.body.data.success).toBe(true);
    expect(change.body.data.sessionsRevoked).toBe(true);
    expect(change.body.data.passwordHash).toBeUndefined();

    const meBlocked = await request(app)
      .get("/v1/me/account")
      .set("Authorization", `Bearer ${before.accessToken}`);
    expect(meBlocked.status).toBe(401);

    const refreshBlocked = await request(app)
      .post("/v1/auth/refresh")
      .send({ refreshToken: session2.refreshToken });
    expect(refreshBlocked.status).toBe(401);

    const oldLogin = await request(app)
      .post("/v1/auth/login")
      .send({ email, password: "ValidPass1" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/v1/auth/login")
      .send({ email, password: "NewValid2" });
    expect(newLogin.status).toBe(200);
  });

  it("T005-N01 password change rejects wrong current password", async () => {
    const email = `pwbad-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const { accessToken } = await loginUser(app, email);

    const res = await request(app)
      .post("/v1/me/password-change")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: "WrongPass1", newPassword: "NewValid2" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("T005-N02 password change rejects weak or same-as-current new password", async () => {
    const email = `pwval-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const { accessToken } = await loginUser(app, email);

    const weak = await request(app)
      .post("/v1/me/password-change")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: "ValidPass1", newPassword: "short" });
    expect(weak.status).toBe(400);

    const same = await request(app)
      .post("/v1/me/password-change")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: "ValidPass1", newPassword: "ValidPass1" });
    expect(same.status).toBe(400);
  });

  it("T005-N03 password change requires authentication", async () => {
    const res = await request(app)
      .post("/v1/me/password-change")
      .send({ currentPassword: "ValidPass1", newPassword: "NewValid2" });
    expect(res.status).toBe(401);
  });

  it("T005-C01 concurrent password change allows at most one success", async () => {
    const email = `pwrace-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const { accessToken } = await loginUser(app, email);

    const [a, b] = await Promise.all([
      request(app)
        .post("/v1/me/password-change")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: "ValidPass1", newPassword: "NewValid2" }),
      request(app)
        .post("/v1/me/password-change")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: "ValidPass1", newPassword: "NewValid3" }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winnerPassword = a.status === 200 ? "NewValid2" : "NewValid3";
    const loserPassword = a.status === 200 ? "NewValid3" : "NewValid2";
    const loginWinner = await request(app)
      .post("/v1/auth/login")
      .send({ email, password: winnerPassword });
    expect(loginWinner.status).toBe(200);
    const loginLoser = await request(app)
      .post("/v1/auth/login")
      .send({ email, password: loserPassword });
    expect(loginLoser.status).toBe(401);
  });

  it("password change is rate limited per user", async () => {
    const email = `pwlimit-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const { accessToken } = await loginUser(app, email);

    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post("/v1/me/password-change")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ currentPassword: "WrongPass1", newPassword: "NewValid2" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it("pending user can change password while logged in", async () => {
    const email = `pwpending-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const { accessToken } = await loginUser(app, email);

    const change = await request(app)
      .post("/v1/me/password-change")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: "ValidPass1", newPassword: "NewValid2" });
    expect(change.status).toBe(200);

    const login = await request(app).post("/v1/auth/login").send({ email, password: "NewValid2" });
    expect(login.status).toBe(200);
  });

  it("suspended user access token is rejected on /v1/me (I-N04)", async () => {
    const email = `suspended-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    await verifyEmail(app, emailSender);
    const { accessToken } = await loginUser(app, email);

    const user = await db.user.findFirstOrThrow({
      where: { emailNormalized: email.toLowerCase() },
    });
    await db.user.update({
      where: { id: user.id },
      data: { accountStatus: "SUSPENDED", suspendedAt: new Date() },
    });

    const account = await request(app)
      .get("/v1/me/account")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(account.status).toBe(401);

    const profile = await request(app)
      .get("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(profile.status).toBe(401);
  });
});
