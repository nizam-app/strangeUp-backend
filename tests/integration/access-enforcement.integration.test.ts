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
import { createIntegrationUser } from "../helpers/integration-user.js";
import { seedMainAppActivatedUser, seedProviderApprovedApplicant } from "../helpers/kyc-applicant.js";
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";
const describeAccess = runIntegration ? describe : describe.skip;

describeAccess("integration: main-app access enforcement (Task 022C)", () => {
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

  async function pendingUser(prefix: string) {
    return createIntegrationUser(app, emailSender, db, prefix, { mainAppAccess: false });
  }

  it("denies main-app routes for email-verified pending user with nextAction", async () => {
    const user = await pendingUser("022c-pending");
    const routes: Array<{ method: "get" | "post"; path: string }> = [
      { method: "get", path: "/v1/discover/people" },
      { method: "get", path: "/v1/home" },
      { method: "get", path: "/v1/store/products" },
      { method: "get", path: "/v1/jobs" },
      { method: "get", path: "/v1/membership/plans" },
      { method: "get", path: "/v1/activities" },
      { method: "get", path: "/v1/groups" },
    ];

    for (const route of routes) {
      const res =
        route.method === "get"
          ? await request(app).get(route.path).set("Authorization", `Bearer ${user.accessToken}`)
          : await request(app).post(route.path).set("Authorization", `Bearer ${user.accessToken}`);
      expect(res.status, route.path).toBe(403);
      expect(res.body.error.code, route.path).toBe("ONBOARDING_REQUIRED");
      expect(res.body.error.homeAccessAllowed, route.path).toBe(false);
      expect(res.body.error.nextAction, route.path).toBeTruthy();
    }
  });

  it("allows onboarding-safe /v1/me routes without main-app access", async () => {
    const user = await pendingUser("022c-safe");
    const status = await request(app)
      .get("/v1/me/onboarding/status")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(status.status).toBe(200);
    expect(status.body.data.homeAccessAllowed).toBe(false);

    const account = await request(app)
      .get("/v1/me/account")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(account.status).toBe(200);

    const sessions = await request(app)
      .get("/v1/me/security/sessions")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(sessions.status).toBe(200);
  });

  it("provider-approved without admin stays denied on main app", async () => {
    const user = await pendingUser("022c-provider-only");
    const sessionId = randomUUID();
    await seedProviderApprovedApplicant(db, user.userId, sessionId, `ref-${sessionId}`);

    const res = await request(app)
      .get("/v1/discover/people")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ONBOARDING_REQUIRED");
  });

  it("admin rejection yields ACCOUNT_NOT_ACTIVATED even with stale JWT assumptions", async () => {
    const user = await pendingUser("022c-rejected");
    const sessionId = randomUUID();
    await seedProviderApprovedApplicant(db, user.userId, sessionId, `ref-${sessionId}`);
    await db.user.update({
      where: { id: user.userId },
      data: {
        adminReviewStatus: "REJECTED",
        adminReviewVerificationSessionId: sessionId,
        adminReviewDecidedAt: new Date(),
      },
    });

    const res = await request(app)
      .get("/v1/home")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_NOT_ACTIVATED");
  });

  it("activated user passes gate; revoked KYC denies after DB flip", async () => {
    const user = await pendingUser("022c-activated");
    await seedMainAppActivatedUser(db, user.userId);

    const ok = await request(app)
      .get("/v1/discover/people")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(ok.status).toBe(200);

    await db.user.update({
      where: { id: user.userId },
      data: { identityVerificationRevokedAt: new Date() },
    });

    const denied = await request(app)
      .get("/v1/discover/people")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(denied.status).toBe(403);
  });

  it("auth and health remain reachable without main-app access", async () => {
    const health = await request(app).get("/health/live");
    expect(health.status).toBe(200);

    const user = await pendingUser("022c-auth");
    const refresh = await request(app)
      .post("/v1/auth/refresh")
      .send({ refreshToken: user.refreshToken });
    expect(refresh.status).toBe(200);
    expect(refresh.body.data.accessToken).toBeTruthy();
  });
});
