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
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";
import { computeHmacSha256Hex } from "../../src/modules/verification/webhook-signature.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";
const describeKyc = runIntegration ? describe : describe.skip;

const WEBHOOK_SECRET = "test-webhook-secret-min-32-characters!";
const defaultConsents = [
  { type: "TERMS", version: "pending-legal-review" },
  { type: "PRIVACY", version: "pending-legal-review" },
  { type: "AGE_ATTESTATION", version: "pending-legal-review" },
];

describeKyc("integration: KYC verification and consent (Task 021)", () => {
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
      KYC_PROVIDER_ENABLED: "true",
      KYC_PROVIDER: "mock",
      KYC_MOCK_WEBHOOK_HMAC_SECRET: WEBHOOK_SECRET,
      CONSENT_ENFORCEMENT: "placeholder_allowed",
    });
    app = createApp({ env, logger: pino({ level: "silent" }), db, emailSender });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeEach(async () => {
    clearRateLimits();
    emailSender.clear();
    await db.$executeRawUnsafe(`
      TRUNCATE TABLE
        "VerificationDecision",
        "VerificationWebhookReceipt",
        "VerificationSession",
        "ConsentRecord",
        "RegisterIdempotency",
        "AuthChallenge",
        "Session",
        "PasswordCredential",
        "Profile",
        "User"
      RESTART IDENTITY CASCADE
    `);
  });

  it("lists server-owned consent requirements", async () => {
    const res = await request(app).get("/v1/consents/required");
    expect(res.status).toBe(200);
    expect(res.body.data.registration).toHaveLength(3);
    expect(res.body.data.enforcementMode).toBe("placeholder_allowed");
  });

  it("rejects registration with unknown consent versions", async () => {
    const res = await request(app)
      .post("/v1/auth/register")
      .send({
        firstName: "Bad",
        lastName: "Consent",
        email: `bad-consent-${Date.now()}@example.com`,
        password: "ValidPass1",
        dateOfBirth: "1995-06-15",
        consents: [
          { type: "TERMS", version: "not-in-registry" },
          { type: "PRIVACY", version: "pending-legal-review" },
          { type: "AGE_ATTESTATION", version: "pending-legal-review" },
        ],
      });
    expect(res.status).toBe(400);
  });

  it("returns FEATURE_DISABLED when provider flag is off", async () => {
    const url = process.env.INTEGRATION_DATABASE_URL!.trim();
    const disabledApp = createApp({
      env: loadEnv({
        NODE_ENV: "test",
        DATABASE_URL: url,
        JWT_ACCESS_SECRET: "test-jwt-access-secret-min-32-chars!!",
        KYC_PROVIDER_ENABLED: "false",
      }),
      logger: pino({ level: "silent" }),
      db,
      emailSender,
    });
    const email = `kyc-off-${Date.now()}@example.com`;
    await request(disabledApp).post("/v1/auth/register").send({
      firstName: "Off",
      lastName: "Provider",
      email,
      password: "ValidPass1",
      dateOfBirth: "1995-06-15",
      consents: defaultConsents,
    });
    const login = await request(disabledApp).post("/v1/auth/login").send({
      email,
      password: "ValidPass1",
    });
    const token = login.body.data.accessToken as string;
    const status = await request(disabledApp)
      .get("/v1/me/verification/status")
      .set("Authorization", `Bearer ${token}`);
    expect(status.status).toBe(200);
    expect(status.body.data.providerRuntimeStatus).toBe("FEATURE_DISABLED");
    expect(status.body.data.canStartVerification).toBe(false);
  });

  it("processes mock webhooks with HMAC, idempotency, and cross-user session isolation", async () => {
    const email = `kyc-flow-${Date.now()}@example.com`;
    const reg = await request(app).post("/v1/auth/register").send({
      firstName: "Flow",
      lastName: "User",
      email,
      password: "ValidPass1",
      dateOfBirth: "1995-06-15",
      consents: defaultConsents,
    });
    expect(reg.status).toBe(201);
    const userId = reg.body.data.userId as string;

    await db.user.update({
      where: { id: userId },
      data: {
        accountStatus: "ACTIVE",
        emailVerifiedAt: new Date(),
        ageEligibilityStatus: "ELIGIBLE",
      },
    });

    const login = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
    const accessToken = login.body.data.accessToken as string;

    const start = await request(app)
      .post("/v1/me/verification/sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});
    expect(start.status).toBe(201);
    const sessionId = start.body.data.sessionId as string;

    const sessionRow = await db.verificationSession.findUnique({ where: { id: sessionId } });
    expect(sessionRow?.userId).toBe(userId);

    const otherEmail = `kyc-other-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send({
      firstName: "Other",
      lastName: "User",
      email: otherEmail,
      password: "ValidPass1",
      dateOfBirth: "1995-06-15",
      consents: defaultConsents,
    });
    await db.user.updateMany({
      where: { emailNormalized: otherEmail.toLowerCase() },
      data: {
        accountStatus: "ACTIVE",
        emailVerifiedAt: new Date(),
        ageEligibilityStatus: "ELIGIBLE",
      },
    });
    const otherLogin = await request(app)
      .post("/v1/auth/login")
      .send({ email: otherEmail, password: "ValidPass1" });
    const otherToken = otherLogin.body.data.accessToken as string;
    const foreignGet = await request(app)
      .get(`/v1/me/verification/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(foreignGet.status).toBe(404);

    const payload = {
      id: "evt-approve-1",
      action: "verification.decision" as const,
      verification: {
        id: sessionRow!.providerSessionRef,
        status: "approved" as const,
      },
    };
    const bodyText = JSON.stringify(payload);
    const raw = Buffer.from(bodyText, "utf8");
    const unsigned = await request(app)
      .post("/v1/webhooks/verification/mock")
      .set("Content-Type", "application/json")
      .send(bodyText);
    expect(unsigned.status).toBe(403);

    const sig = computeHmacSha256Hex(WEBHOOK_SECRET, raw);
    const ok = await request(app)
      .post("/v1/webhooks/verification/mock")
      .set("Content-Type", "application/json")
      .set("x-hmac-signature", sig)
      .send(bodyText);
    expect(ok.status).toBe(200);

    const userAfter = await db.user.findUnique({ where: { id: userId } });
    expect(userAfter?.identityVerificationStatus).toBe("APPROVED");

    const replay = await request(app)
      .post("/v1/webhooks/verification/mock")
      .set("Content-Type", "application/json")
      .set("x-hmac-signature", sig)
      .send(bodyText);
    expect(replay.status).toBe(200);
    expect(replay.body.data.duplicate).toBe(true);

    const tamperedText = JSON.stringify({ ...payload, id: "evt-tamper" });
    const badSig = computeHmacSha256Hex(WEBHOOK_SECRET, raw);
    const tamperedReq = await request(app)
      .post("/v1/webhooks/verification/mock")
      .set("Content-Type", "application/json")
      .set("x-hmac-signature", badSig)
      .send(tamperedText);
    expect(tamperedReq.status).toBe(403);

    const secondStart = await request(app)
      .post("/v1/me/verification/sessions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});
    expect(secondStart.status).toBe(409);
  });
});
