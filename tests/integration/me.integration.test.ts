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
    expect(account.body.data.accountStatus).toBe("PENDING_VERIFICATION");
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
  });
});
