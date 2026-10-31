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

async function registerAndLogin(
  app: ReturnType<typeof createApp>,
  prefix: string,
): Promise<{ userId: string; accessToken: string }> {
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

describeAdmin("integration: admin identity review decisions pagination (Task 031G)", () => {
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

  it("denies unauthenticated and non-reviewer access", async () => {
    const applicantId = randomUUID();
    const unauth = await request(app).get(`/v1/admin/identity-reviews/${applicantId}/decisions`);
    expect(unauth.status).toBe(401);

    const user = await registerAndLogin(app, "no-reviewer-decisions");
    const forbidden = await request(app)
      .get(`/v1/admin/identity-reviews/${applicantId}/decisions`)
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(forbidden.status).toBe(403);
  });

  it("returns paginated decisions scoped to reviewId", async () => {
    const reviewer = await registerAndLogin(app, "reviewer-decisions");
    await grantIdentityReviewer(db, reviewer.userId);

    const applicant = await registerAndLogin(app, "applicant-decisions");
    const sessionId = randomUUID();
    await seedProviderApprovedApplicant(db, applicant.userId, sessionId, `mock-ref-${Date.now()}`);

    const idempotencyKey = randomUUID();
    const approve = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .set("Idempotency-Key", idempotencyKey);
    expect(approve.status).toBe(200);

    const list = await request(app)
      .get(`/v1/admin/identity-reviews/${applicant.userId}/decisions?limit=20`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.decisions).toHaveLength(1);
    expect(list.body.data.decisions[0].status).toBe("APPROVED");
    expect(list.body.data.decisions[0].reviewerDisplayLabel).toBeTruthy();
    expect(list.body.data.decisions[0]).not.toHaveProperty("idempotencyKey");
    expect(JSON.stringify(list.body)).not.toContain("accessToken");

    const missingReviewId = randomUUID();
    const notFound = await request(app)
      .get(`/v1/admin/identity-reviews/${missingReviewId}/decisions`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(notFound.status).toBe(404);
  });

  it("validates UUID and cursor parameters", async () => {
    const reviewer = await registerAndLogin(app, "reviewer-decisions-val");
    await grantIdentityReviewer(db, reviewer.userId);

    const badUuid = await request(app)
      .get("/v1/admin/identity-reviews/not-a-uuid/decisions")
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(badUuid.status).toBe(400);

    const applicant = await registerAndLogin(app, "applicant-decisions-val");
    const sessionId = randomUUID();
    await seedProviderApprovedApplicant(
      db,
      applicant.userId,
      sessionId,
      `mock-ref-val-${Date.now()}`,
    );

    const badCursor = await request(app)
      .get(`/v1/admin/identity-reviews/${applicant.userId}/decisions?cursor=not valid!`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(badCursor.status).toBe(400);
  });
});
