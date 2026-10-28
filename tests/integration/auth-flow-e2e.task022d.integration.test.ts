/**
 * Task 022D — bounded auth-flow E2E (security / activation journeys).
 * Does not replace full integration regression (022C: 117 passed).
 */
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
import {
  createCapturingEmailSender,
  extractPasswordResetTokenFromText,
  extractVerificationTokenFromText,
} from "../helpers/capturing-email-sender.js";
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";
import { grantIdentityReviewer, mockApproveWebhookBody, signMockWebhook, KYC_TEST_WEBHOOK_SECRET } from "../helpers/kyc-applicant.js";
import { DEFAULT_INTEGRATION_CONSENTS } from "../helpers/integration-user.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";
const describe022D = runIntegration ? describe : describe.skip;

describe022D("integration: Task 022D auth-flow E2E", () => {
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

  async function registerVerifyLogin(prefix: string): Promise<{
    userId: string;
    accessToken: string;
    refreshToken: string;
    email: string;
  }> {
    const email = `${prefix}-${Date.now()}@example.com`;
    const reg = await request(app).post("/v1/auth/register").send({
      firstName: "Flow",
      lastName: "User",
      email,
      password: "ValidPass1",
      dateOfBirth: "1995-06-15",
      consents: [...DEFAULT_INTEGRATION_CONSENTS],
    });
    expect(reg.status).toBe(201);
    expect(reg.body.data.accessToken).toBeUndefined();

    const token = extractVerificationTokenFromText(emailSender.lastMessage?.text ?? "");
    expect(token).toBeTruthy();
    await request(app).post("/v1/auth/email-verification/confirm").send({ token });

    const login = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
    expect(login.status).toBe(200);
    expect(login.body.data.user.fullAccess).toBe(false);
    return {
      email,
      userId: login.body.data.user.id as string,
      accessToken: login.body.data.accessToken as string,
      refreshToken: login.body.data.refreshToken as string,
    };
  }

  it("T022D-J01 register → email → IDV session → provider webhook → admin approve → Home", async () => {
    const reviewer = await registerVerifyLogin("022d-reviewer");
    await grantIdentityReviewer(db, reviewer.userId);

    const applicant = await registerVerifyLogin("022d-applicant");

    const onboardingMid = await request(app)
      .get("/v1/me/onboarding/status")
      .set("Authorization", `Bearer ${applicant.accessToken}`);
    expect(onboardingMid.status).toBe(200);
    expect(onboardingMid.body.data.homeAccessAllowed).toBe(false);
    expect(["READY_FOR_IDENTITY_VERIFICATION", "IDENTITY_VERIFICATION_IN_PROGRESS"]).toContain(
      onboardingMid.body.data.onboardingPhase,
    );

    const start = await request(app)
      .post("/v1/me/verification/sessions")
      .set("Authorization", `Bearer ${applicant.accessToken}`)
      .send({});
    expect(start.status).toBe(201);
    const sessionRow = await db.verificationSession.findUniqueOrThrow({
      where: { id: start.body.data.sessionId as string },
    });

    const webhookBody = JSON.stringify(
      mockApproveWebhookBody(sessionRow.providerSessionRef, `evt-${Date.now()}`),
    );
    await request(app)
      .post("/v1/webhooks/verification/mock")
      .set("Content-Type", "application/json")
      .set("x-hmac-signature", signMockWebhook(webhookBody))
      .send(webhookBody);

    const awaitingAdmin = await request(app)
      .get("/v1/me/onboarding/status")
      .set("Authorization", `Bearer ${applicant.accessToken}`);
    expect(awaitingAdmin.body.data.onboardingPhase).toBe("AWAITING_ADMIN_REVIEW");
    expect(awaitingAdmin.body.data.nextAction).toBe("WAIT_FOR_ADMIN_REVIEW");

    await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .expect(200);

    const activated = await request(app)
      .get("/v1/me/onboarding/status")
      .set("Authorization", `Bearer ${applicant.accessToken}`);
    expect(activated.body.data.homeAccessAllowed).toBe(true);
    expect(activated.body.data.onboardingPhase).toBe("FULLY_ACTIVATED");
    expect(activated.body.data.nextAction).toBe("HOME_READY");

    const home = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${applicant.accessToken}`);
    expect(home.status).toBe(200);
  });

  it("T022D-J02 pending login: fullAccess false; main app 403 with nextAction", async () => {
    const user = await registerVerifyLogin("022d-pending");
    const home = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(home.status).toBe(403);
    expect(home.body.error.code).toBe("ONBOARDING_REQUIRED");
    expect(home.body.error.nextAction).toBeTruthy();
  });

  it("T022D-J03 admin rejection: login OK; Home ACCOUNT_NOT_ACTIVATED", async () => {
    const reviewer = await registerVerifyLogin("022d-rej-rev");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerVerifyLogin("022d-rej-app");
    const sessionId = randomUUID();
    const providerRef = `ref-rej-${Date.now()}`;
    await db.verificationSession.create({
      data: {
        id: sessionId,
        userId: applicant.userId,
        provider: "MOCK",
        providerSessionRef: providerRef,
        status: "APPROVED",
        sessionExpiresAt: new Date(Date.now() + 3_600_000),
        completedAt: new Date(),
      },
    });
    await db.user.update({
      where: { id: applicant.userId },
      data: {
        identityVerificationStatus: "APPROVED",
        identityVerificationApprovedAt: new Date(),
        identityVerificationSessionId: sessionId,
        adminReviewStatus: "PENDING",
        adminReviewVerificationSessionId: sessionId,
      },
    });

    await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/reject`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .send({ reasonCode: "POLICY_INELIGIBLE" });

    const login = await request(app)
      .post("/v1/auth/login")
      .send({ email: applicant.email, password: "ValidPass1" });
    expect(login.status).toBe(200);
    expect(login.body.data.user.fullAccess).toBe(false);

    const home = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(home.status).toBe(403);
    expect(home.body.error.code).toBe("ACCOUNT_NOT_ACTIVATED");
  });

  it("T022D-J04 legacy-style active email user without admin cannot reach Home", async () => {
    const user = await registerVerifyLogin("022d-legacy");
    await db.user.update({
      where: { id: user.userId },
      data: {
        accountStatus: "ACTIVE",
        emailVerifiedAt: new Date(),
        ageEligibilityStatus: "ELIGIBLE",
        identityVerificationStatus: "NOT_STARTED",
        adminReviewStatus: "NOT_READY",
      },
    });

    const login = await request(app)
      .post("/v1/auth/login")
      .send({ email: user.email, password: "ValidPass1" });
    expect(login.body.data.user.fullAccess).toBe(false);

    const home = await request(app)
      .get("/v1/discover/people")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(home.status).toBe(403);
    expect(home.body.error.code).toBe("ONBOARDING_REQUIRED");
  });

  it("T022D-J05 post-activation KYC revocation denies Home on existing JWT", async () => {
    const reviewer = await registerVerifyLogin("022d-rev-rev");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerVerifyLogin("022d-rev-app");
    const sessionId = randomUUID();
    await db.verificationSession.create({
      data: {
        id: sessionId,
        userId: applicant.userId,
        provider: "MOCK",
        providerSessionRef: `ref-${sessionId}`,
        status: "APPROVED",
        sessionExpiresAt: new Date(Date.now() + 3_600_000),
        completedAt: new Date(),
      },
    });
    await db.user.update({
      where: { id: applicant.userId },
      data: {
        identityVerificationStatus: "APPROVED",
        identityVerificationApprovedAt: new Date(),
        identityVerificationSessionId: sessionId,
        adminReviewStatus: "PENDING",
        adminReviewVerificationSessionId: sessionId,
      },
    });
    await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`);

    const ok = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${applicant.accessToken}`);
    expect(ok.status).toBe(200);

    await db.user.update({
      where: { id: applicant.userId },
      data: { identityVerificationRevokedAt: new Date() },
    });

    const denied = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${applicant.accessToken}`);
    expect(denied.status).toBe(403);
  });

  it("T022D-J06 password reset: sessions revoked; re-login reaches onboarding not Home", async () => {
    const user = await registerVerifyLogin("022d-pw");
    emailSender.clear();
    await request(app).post("/v1/auth/password-reset/request").send({ email: user.email });
    const resetToken = extractPasswordResetTokenFromText(emailSender.lastMessage?.text ?? "");
    expect(resetToken).toBeTruthy();
    await request(app)
      .post("/v1/auth/password-reset/confirm")
      .send({ token: resetToken, newPassword: "NewValidPass2" });

    const oldToken = await request(app)
      .get("/v1/me/account")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(oldToken.status).toBe(401);

    const login = await request(app)
      .post("/v1/auth/login")
      .send({ email: user.email, password: "NewValidPass2" });
    expect(login.status).toBe(200);
    expect(login.body.data.user.fullAccess).toBe(false);

    const home = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(home.status).toBe(403);
    expect(home.body.error.code).toBe("ONBOARDING_REQUIRED");
  });

  it("T022D-J07 refresh while pending: new access token still blocked from Home", async () => {
    const user = await registerVerifyLogin("022d-ref");
    const refreshed = await request(app)
      .post("/v1/auth/refresh")
      .send({ refreshToken: user.refreshToken });
    expect(refreshed.status).toBe(200);
    const newAccess = refreshed.body.data.accessToken as string;

    const home = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${newAccess}`);
    expect(home.status).toBe(403);
    expect(home.body.error.code).toBe("ONBOARDING_REQUIRED");
  });
});
