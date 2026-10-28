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
import { hasHomeAccess, toActivationPolicyActor } from "../../src/modules/policy/effective-access-policy.js";
import {
  grantIdentityReviewer,
  mockApproveWebhookBody,
  seedProviderApprovedApplicant,
  signMockWebhook,
  KYC_TEST_WEBHOOK_SECRET,
} from "../helpers/kyc-applicant.js";

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
): Promise<{ userId: string; accessToken: string; email: string }> {
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
    email,
    userId: login.body.data.user.id as string,
    accessToken: login.body.data.accessToken as string,
  };
}

describeAdmin("integration: admin identity review (Task 022B)", () => {
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
      KYC_MOCK_WEBHOOK_HMAC_SECRET: KYC_TEST_WEBHOOK_SECRET,
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

  it("denies ordinary users on admin list", async () => {
    const user = await registerAndLogin(app, "no-admin");
    const res = await request(app)
      .get("/v1/admin/identity-reviews?status=PENDING")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(403);
  });

  it("provider-approved applicant enters PENDING admin queue; admin approve grants Home access", async () => {
    const reviewer = await registerAndLogin(app, "reviewer");
    await grantIdentityReviewer(db, reviewer.userId);

    const applicant = await registerAndLogin(app, "applicant");
    const sessionId = randomUUID();
    const providerRef = `mock-ref-${Date.now()}`;
    await seedProviderApprovedApplicant(db, applicant.userId, sessionId, providerRef);

    const list = await request(app)
      .get("/v1/admin/identity-reviews?status=PENDING")
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.reviews.some((r: { reviewId: string }) => r.reviewId === applicant.userId)).toBe(
      true,
    );

    const onboardingBefore = await request(app)
      .get("/v1/me/onboarding/status")
      .set("Authorization", `Bearer ${applicant.accessToken}`);
    expect(onboardingBefore.body.data.onboardingPhase).toBe("AWAITING_ADMIN_REVIEW");
    expect(onboardingBefore.body.data.homeAccessAllowed).toBe(false);

    const approve = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(approve.status).toBe(200);
    expect(approve.body.data.adminReviewStatus).toBe("APPROVED");

    const userRow = await db.user.findUniqueOrThrow({ where: { id: applicant.userId } });
    expect(hasHomeAccess(toActivationPolicyActor(userRow))).toBe(true);

    const home = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${applicant.accessToken}`);
    expect(home.status).toBe(200);

    const audit = await db.identityAdminReviewDecision.findMany({
      where: { userId: applicant.userId },
    });
    expect(audit.some((a) => a.status === "APPROVED" && a.reviewerUserId === reviewer.userId)).toBe(true);
  });

  it("cannot approve without provider APPROVED", async () => {
    const reviewer = await registerAndLogin(app, "rev2");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant2");
    await db.user.update({
      where: { id: applicant.userId },
      data: {
        accountStatus: "ACTIVE",
        emailVerifiedAt: new Date(),
        ageEligibilityStatus: "ELIGIBLE",
        adminReviewStatus: "PENDING",
      },
    });

    const res = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(res.status).toBe(403);
  });

  it("admin reject records audit and onboarding shows ADMIN_REJECTED", async () => {
    const reviewer = await registerAndLogin(app, "rev3");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant3");
    const sessionId = randomUUID();
    await seedProviderApprovedApplicant(db, applicant.userId, sessionId, `ref-${Date.now()}`);

    const reject = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/reject`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .send({ reasonCode: "POLICY_INELIGIBLE" });
    expect(reject.status).toBe(200);

    const onboarding = await request(app)
      .get("/v1/me/onboarding/status")
      .set("Authorization", `Bearer ${applicant.accessToken}`);
    expect(onboarding.body.data.onboardingPhase).toBe("ADMIN_REJECTED");
    expect(onboarding.body.data.nextAction).toBe("ADMIN_REJECTED");
  });

  it("idempotent approve with Idempotency-Key", async () => {
    const reviewer = await registerAndLogin(app, "rev4");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant4");
    const sessionId = randomUUID();
    await seedProviderApprovedApplicant(db, applicant.userId, sessionId, `ref-${Date.now()}`);
    const key = `approve-${Date.now()}`;
    const first = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .set("Idempotency-Key", key);
    const second = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .set("Idempotency-Key", key);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.idempotentReplay).toBe(true);
    const decisions = await db.identityAdminReviewDecision.count({
      where: { userId: applicant.userId, status: "APPROVED" },
    });
    expect(decisions).toBe(1);
  });

  it("provider expiry after admin approval removes Home access", async () => {
    const reviewer = await registerAndLogin(app, "rev5");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant5");
    const sessionId = randomUUID();
    const providerRef = `ref-exp-${Date.now()}`;
    await seedProviderApprovedApplicant(db, applicant.userId, sessionId, providerRef);

    await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`);

    const expiredBody = JSON.stringify({
      id: `evt-exp-${Date.now()}`,
      action: "verification.decision",
      verification: { id: providerRef, status: "expired" },
    });
    const sig = signMockWebhook(expiredBody);
    await request(app)
      .post("/v1/webhooks/verification/mock")
      .set("Content-Type", "application/json")
      .set("x-hmac-signature", sig)
      .send(expiredBody);

    const home = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${applicant.accessToken}`);
    expect(home.status).toBe(403);
  });

  it("webhook approve flow matches session and enters admin queue via API", async () => {
    const reviewer = await registerAndLogin(app, "rev6");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant6");
    await db.user.update({
      where: { id: applicant.userId },
      data: {
        accountStatus: "ACTIVE",
        emailVerifiedAt: new Date(),
        ageEligibilityStatus: "ELIGIBLE",
      },
    });

    const start = await request(app)
      .post("/v1/me/verification/sessions")
      .set("Authorization", `Bearer ${applicant.accessToken}`)
      .send({});
    expect(start.status).toBe(201);
    const sessionId = start.body.data.sessionId as string;
    const sessionRow = await db.verificationSession.findUniqueOrThrow({ where: { id: sessionId } });

    const body = JSON.stringify(mockApproveWebhookBody(sessionRow.providerSessionRef, `evt-${Date.now()}`));
    await request(app)
      .post("/v1/webhooks/verification/mock")
      .set("Content-Type", "application/json")
      .set("x-hmac-signature", signMockWebhook(body))
      .send(body);

    const userAfter = await db.user.findUniqueOrThrow({ where: { id: applicant.userId } });
    expect(userAfter.adminReviewStatus).toBe("PENDING");

    await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    const home = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${applicant.accessToken}`);
    expect(home.status).toBe(200);
  });
});
