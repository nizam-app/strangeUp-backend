import { randomUUID } from "node:crypto";
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
import { grantIdentityReviewer, seedProviderApprovedApplicant } from "../helpers/kyc-applicant.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";
const describeAdmin = runIntegration ? describe : describe.skip;

const defaultConsents = [
  { type: "TERMS", version: "pending-legal-review" },
  { type: "PRIVACY", version: "pending-legal-review" },
  { type: "AGE_ATTESTATION", version: "pending-legal-review" },
];

async function registerAndLogin(app: ReturnType<typeof createApp>, prefix: string) {
  const email = `${prefix}-${Date.now()}@example.com`;
  await request(app).post("/v1/auth/register").send({
    firstName: "Admin",
    lastName: "Test",
    email,
    password: "ValidPass1",
    dateOfBirth: "1995-06-15",
    consents: defaultConsents,
  });
  const login = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
  expect(login.status).toBe(200);
  return {
    userId: login.body.data.user.id as string,
    accessToken: login.body.data.accessToken as string,
  };
}

describeAdmin("integration: identity review CSV export (Task 031H-1)", () => {
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
      KYC_MOCK_WEBHOOK_HMAC_SECRET: "test-webhook-secret-min-32-chars-long!!",
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
        "IdentityAdminReviewInternalNote",
        "IdentityAdminReviewIdempotencyReservation",
        "IdentityAdminReviewDecision",
        "PlatformStaffGrant",
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

  it("denies anonymous and non-reviewer export", async () => {
    const unauth = await request(app).get("/v1/admin/identity-reviews/export?status=PENDING");
    expect(unauth.status).toBe(401);

    const user = await registerAndLogin(app, "no-reviewer-export");
    const forbidden = await request(app)
      .get("/v1/admin/identity-reviews/export?status=PENDING")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(forbidden.status).toBe(403);
  });

  it("returns CSV with safe headers for reviewer", async () => {
    const reviewer = await registerAndLogin(app, "reviewer-export");
    await grantIdentityReviewer(db, reviewer.userId);

    const applicant = await registerAndLogin(app, "applicant-export");
    const sessionId = randomUUID();
    await seedProviderApprovedApplicant(db, applicant.userId, sessionId, `mock-ref-${Date.now()}`);

    const res = await request(app)
      .get("/v1/admin/identity-reviews/export?status=PENDING")
      .set("Authorization", `Bearer ${reviewer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["cache-control"]).toMatch(/no-store/);
    expect(res.headers["content-disposition"]).toMatch(/attachment/);
    expect(res.text).toContain("review_id");
    expect(res.text).toContain("masked_email");
    expect(res.text).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(res.text).toContain("***");
    expect(JSON.stringify(res.text)).not.toContain("accessToken");
  });

  it("routes /export before /:reviewId", async () => {
    const reviewer = await registerAndLogin(app, "reviewer-export-route");
    await grantIdentityReviewer(db, reviewer.userId);
    const res = await request(app)
      .get("/v1/admin/identity-reviews/export?status=APPROVED")
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
  });
});
