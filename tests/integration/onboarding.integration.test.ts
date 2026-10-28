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
const describeOnboarding = runIntegration ? describe : describe.skip;

const defaultConsents = [
  { type: "TERMS", version: "pending-legal-review" },
  { type: "PRIVACY", version: "pending-legal-review" },
  { type: "AGE_ATTESTATION", version: "pending-legal-review" },
];

describeOnboarding("integration: onboarding status (Task 022A)", () => {
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
      KYC_MOCK_WEBHOOK_HMAC_SECRET: "test-webhook-secret-min-32-characters!",
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
        "IdentityAdminReviewDecision",
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

  it("register returns no tokens; login exposes fullAccess false", async () => {
    const email = `onb-reg-${Date.now()}@example.com`;
    const reg = await request(app).post("/v1/auth/register").send({
      firstName: "Onb",
      lastName: "User",
      email,
      password: "ValidPass1",
      dateOfBirth: "1995-06-15",
      consents: defaultConsents,
    });
    expect(reg.status).toBe(201);
    expect(reg.body.data.accessToken).toBeUndefined();

    const login = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
    expect(login.status).toBe(200);
    expect(login.body.data.user.fullAccess).toBe(false);
  });

  it("onboarding status guides VERIFY_EMAIL then IDV after email confirm", async () => {
    const email = `onb-flow-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send({
      firstName: "Flow",
      lastName: "User",
      email,
      password: "ValidPass1",
      dateOfBirth: "1995-06-15",
      consents: defaultConsents,
    });
    const login1 = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
    const token1 = login1.body.data.accessToken as string;

    const pending = await request(app)
      .get("/v1/me/onboarding/status")
      .set("Authorization", `Bearer ${token1}`);
    expect(pending.status).toBe(200);
    expect(pending.body.data.homeAccessAllowed).toBe(false);
    expect(pending.body.data.nextAction).toBe("VERIFY_EMAIL");

    const verifyToken = extractVerificationTokenFromText(emailSender.lastMessage?.text ?? "");
    await request(app).post("/v1/auth/email-verification/confirm").send({ token: verifyToken });

    const login2 = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
    const token2 = login2.body.data.accessToken as string;
    expect(login2.body.data.user.fullAccess).toBe(false);

    const ready = await request(app)
      .get("/v1/me/onboarding/status")
      .set("Authorization", `Bearer ${token2}`);
    expect(ready.status).toBe(200);
    expect(ready.body.data.canStartVerification).toBe(true);
    expect(ready.body.data.nextAction).toBe("START_IDENTITY_VERIFICATION");
    expect(ready.body.data.homeAccessAllowed).toBe(false);

    const start = await request(app)
      .post("/v1/me/verification/sessions")
      .set("Authorization", `Bearer ${token2}`)
      .send({});
    expect(start.status).toBe(201);
  });

  it("home feed remains forbidden before admin activation", async () => {
    const email = `onb-home-${Date.now()}@example.com`;
    await request(app).post("/v1/auth/register").send({
      firstName: "Home",
      lastName: "Blocked",
      email,
      password: "ValidPass1",
      dateOfBirth: "1995-06-15",
      consents: defaultConsents,
    });
    const token = extractVerificationTokenFromText(emailSender.lastMessage?.text ?? "");
    await request(app).post("/v1/auth/email-verification/confirm").send({ token });
    const login = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
    const accessToken = login.body.data.accessToken as string;

    const home = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(home.status).toBe(403);
  });
});
