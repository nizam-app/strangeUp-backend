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
import {
  SCRYPT_PARAMS_LEGACY,
  SCRYPT_PARAMS_PREFERRED,
  hashPasswordWithParams,
} from "../../src/modules/auth/crypto.js";

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
): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const login = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
  expect(login.status).toBe(200);
  return {
    accessToken: login.body.data.accessToken as string,
    refreshToken: login.body.data.refreshToken as string,
  };
}

const describeAuth = runIntegration ? describe : describe.skip;

describeAuth("integration: auth flows", () => {
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

  it("I-P01 register creates user without plaintext password or session tokens", async () => {
    const email = `user-${Date.now()}@example.com`;
    const res = await request(app).post("/v1/auth/register").send(registerPayload(email));
    expect(res.status).toBe(201);
    expect(res.body.data.emailVerificationRequired).toBe(true);
    expect(res.body.data.accessToken).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();

    const user = await db.user.findFirst({ where: { emailNormalized: email.toLowerCase() } });
    expect(user).not.toBeNull();
    const cred = await db.passwordCredential.findUnique({ where: { userId: user!.id } });
    expect(cred?.passwordHash).not.toContain("ValidPass1");
  });

  it("I-N01 duplicate email returns conflict", async () => {
    const email = `dup-${Date.now()}@example.com`;
    const first = await request(app).post("/v1/auth/register").send(registerPayload(email));
    expect(first.status).toBe(201);
    const second = await request(app).post("/v1/auth/register").send(registerPayload(email));
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("CONFLICT");
  });

  it("I-P02 login and I-P03 refresh rotation", async () => {
    const email = `login-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));

    const login = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
    expect(login.status).toBe(200);
    const refresh1 = login.body.data.refreshToken;

    const rotated = await request(app).post("/v1/auth/refresh").send({ refreshToken: refresh1 });
    expect(rotated.status).toBe(200);
    const refresh2 = rotated.body.data.refreshToken;

    const replay = await request(app).post("/v1/auth/refresh").send({ refreshToken: refresh1 });
    expect(replay.status).toBe(401);

    const afterFamilyRevoke = await request(app)
      .post("/v1/auth/refresh")
      .send({ refreshToken: refresh2 });
    expect(afterFamilyRevoke.status).toBe(401);
  });

  it("I-P05 email verification confirm activates eligible account", async () => {
    const email = `verify-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const token = extractVerificationTokenFromText(emailSender.lastMessage?.text ?? "");
    expect(token).toBeTruthy();

    const confirm = await request(app).post("/v1/auth/email-verification/confirm").send({ token });
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.accountStatus).toBe("ACTIVE");

    const user = await db.user.findFirst({ where: { emailNormalized: email.toLowerCase() } });
    expect(user?.emailVerifiedAt).not.toBeNull();
  });

  it("I-N03 wrong password returns generic 401", async () => {
    const email = `badpw-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const res = await request(app).post("/v1/auth/login").send({ email, password: "WrongPass1" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("AUTH_INVALID_CREDENTIALS");
  });

  it("I-N02 rejects underage and future dateOfBirth", async () => {
    const underage = await request(app)
      .post("/v1/auth/register")
      .send(registerPayload(`young-${Date.now()}@example.com`, "2015-01-01"));
    expect(underage.status).toBe(400);
    expect(underage.body.error.code).toBe("VALIDATION_ERROR");

    const future = await request(app)
      .post("/v1/auth/register")
      .send(registerPayload(`future-${Date.now()}@example.com`, "2099-01-01"));
    expect(future.status).toBe(400);
  });

  it("I-P04 logout revokes refresh token (I-N10 access token rejected)", async () => {
    const email = `logout-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const { accessToken, refreshToken } = await loginUser(app, email);

    const logout = await request(app)
      .post("/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(logout.status).toBe(200);

    const refreshAfter = await request(app).post("/v1/auth/refresh").send({ refreshToken });
    expect(refreshAfter.status).toBe(401);

    const protectedAfter = await request(app)
      .post("/v1/auth/logout-all")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(protectedAfter.status).toBe(401);
  });

  it("logout-all revokes every session for the user", async () => {
    const email = `logoutall-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const session1 = await loginUser(app, email);
    const session2 = await loginUser(app, email);

    const logoutAll = await request(app)
      .post("/v1/auth/logout-all")
      .set("Authorization", `Bearer ${session1.accessToken}`);
    expect(logoutAll.status).toBe(200);

    const refresh1 = await request(app)
      .post("/v1/auth/refresh")
      .send({ refreshToken: session1.refreshToken });
    expect(refresh1.status).toBe(401);
    const refresh2 = await request(app)
      .post("/v1/auth/refresh")
      .send({ refreshToken: session2.refreshToken });
    expect(refresh2.status).toBe(401);
  });

  it("I-N04 suspended account cannot login, refresh, or use access token", async () => {
    const email = `suspended-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const before = await loginUser(app, email);

    const user = await db.user.findFirstOrThrow({
      where: { emailNormalized: email.toLowerCase() },
    });
    await db.user.update({
      where: { id: user.id },
      data: { accountStatus: "SUSPENDED", suspendedAt: new Date() },
    });

    const loginBlocked = await request(app)
      .post("/v1/auth/login")
      .send({ email, password: "ValidPass1" });
    expect(loginBlocked.status).toBe(403);
    expect(loginBlocked.body.error.code).toBe("AUTH_FORBIDDEN");

    const refreshBlocked = await request(app)
      .post("/v1/auth/refresh")
      .send({ refreshToken: before.refreshToken });
    expect(refreshBlocked.status).toBe(401);

    const accessBlocked = await request(app)
      .post("/v1/auth/email-verification/request")
      .set("Authorization", `Bearer ${before.accessToken}`);
    expect(accessBlocked.status).toBe(401);
  });

  it("email verification rejects invalid and reused tokens", async () => {
    const invalid = await request(app)
      .post("/v1/auth/email-verification/confirm")
      .send({ token: "not-a-real-token" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("AUTH_CHALLENGE_EXPIRED");

    const email = `verify2-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const token = extractVerificationTokenFromText(emailSender.lastMessage?.text ?? "");
    const first = await request(app).post("/v1/auth/email-verification/confirm").send({ token });
    expect(first.status).toBe(200);
    const second = await request(app).post("/v1/auth/email-verification/confirm").send({ token });
    expect(second.status).toBe(400);
  });

  it("register idempotency returns same response for same key and body", async () => {
    const email = `idem-${Date.now()}@example.com`;
    const key = `idem-key-${Date.now()}`;
    const body = registerPayload(email);
    const first = await request(app)
      .post("/v1/auth/register")
      .set("Idempotency-Key", key)
      .send(body);
    expect(first.status).toBe(201);
    const second = await request(app)
      .post("/v1/auth/register")
      .set("Idempotency-Key", key)
      .send(body);
    expect(second.status).toBe(201);
    expect(second.body.data.userId).toBe(first.body.data.userId);

    const conflict = await request(app)
      .post("/v1/auth/register")
      .set("Idempotency-Key", key)
      .send({ ...body, firstName: "Other" });
    expect(conflict.status).toBe(409);
  });

  it("stores consent evidence with client-supplied versions", async () => {
    const email = `consent-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const user = await db.user.findFirstOrThrow({
      where: { emailNormalized: email.toLowerCase() },
    });
    const consents = await db.consentRecord.findMany({ where: { userId: user.id } });
    expect(consents).toHaveLength(3);
    expect(consents.every((c) => c.documentVersion === "pending-legal-review")).toBe(true);
  });

  it("login rehashes legacy scrypt cost to preferred parameters", async () => {
    const email = `rehash-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const user = await db.user.findFirstOrThrow({
      where: { emailNormalized: email.toLowerCase() },
    });
    const legacyHash = await hashPasswordWithParams("ValidPass1", SCRYPT_PARAMS_LEGACY);
    await db.passwordCredential.update({
      where: { userId: user.id },
      data: { passwordHash: legacyHash },
    });

    const login = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
    expect(login.status).toBe(200);

    const cred = await db.passwordCredential.findUnique({ where: { userId: user.id } });
    expect(cred?.passwordHash).toContain(`$${SCRYPT_PARAMS_PREFERRED.p}$`);
    expect(cred?.passwordHash).not.toContain(`$${SCRYPT_PARAMS_LEGACY.p}$`);
  });

  it("rejects expired refresh tokens", async () => {
    const email = `expired-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send(registerPayload(email));
    const { refreshToken } = await loginUser(app, email);
    const hash = await import("../../src/modules/auth/crypto.js").then((m) =>
      m.hashSha256(refreshToken),
    );
    await db.session.updateMany({
      data: { expiresAt: new Date(Date.now() - 60_000) },
      where: { refreshTokenHash: hash },
    });
    const res = await request(app).post("/v1/auth/refresh").send({ refreshToken });
    expect(res.status).toBe(401);
  });
});
