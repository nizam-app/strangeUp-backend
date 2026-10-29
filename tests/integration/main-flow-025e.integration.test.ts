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
import { seedMainAppActivatedUser } from "../helpers/kyc-applicant.js";
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";
const describe025e = runIntegration ? describe : describe.skip;

const MAIN_TAB_ROUTES: Array<{ method: "get"; path: string }> = [
  { method: "get", path: "/v1/home" },
  { method: "get", path: "/v1/discover/people" },
  { method: "get", path: "/v1/activities" },
  { method: "get", path: "/v1/store/products" },
  { method: "get", path: "/v1/me/settings/overview" },
];

describe025e("integration: main flow 025E cross-tab E2E (Task 025E)", () => {
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
      ACTIVITY_UPLOAD_DIR: ".data/test-activity-media",
    });
    app = createApp({
      env,
      logger: pino({ level: "silent" }),
      db,
      emailSender,
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeEach(() => {
    clearRateLimits();
    emailSender.clear();
  });

  it("T025E-E01 activated user loads all five main-tab contracts", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "t025e-tabs");
    for (const route of MAIN_TAB_ROUTES) {
      const res = await request(app)
        .get(route.path)
        .set("Authorization", `Bearer ${user.accessToken}`);
      expect(res.status, route.path).toBe(200);
    }
    const cart = await request(app)
      .get("/v1/me/store/cart")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(cart.status).toBe(200);
    expect(cart.body.data.checkout.status).toBe("UNAVAILABLE");
  });

  it("T025E-E02 pending user blocked on main tabs; onboarding-safe profile OK", async () => {
    const pending = await createIntegrationUser(app, emailSender, db, "t025e-pending", {
      mainAppAccess: false,
    });
    for (const route of MAIN_TAB_ROUTES) {
      const res = await request(app)
        .get(route.path)
        .set("Authorization", `Bearer ${pending.accessToken}`);
      expect(res.status, route.path).toBe(403);
      expect(res.body.error.homeAccessAllowed, route.path).toBe(false);
    }
    const profile = await request(app)
      .get("/v1/me/profile")
      .set("Authorization", `Bearer ${pending.accessToken}`);
    expect(profile.status).toBe(200);
  });

  it("T025E-S01 legal name stays locked after KYC revocation (home denied)", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "t025e-revoke", {
      mainAppAccess: false,
    });
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
      .get("/v1/home")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(denied.status).toBe(403);

    const profile = await request(app)
      .get("/v1/me/profile")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.legalNameLocked).toBe(true);

    const rename = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ firstName: "Bypass" });
    expect(rename.status).toBe(403);
  });

  it("T025E-S02 legal name stays locked after provider expiry clears denormalized KYC fields", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "t025e-expired", {
      mainAppAccess: false,
    });
    const { sessionId } = await seedMainAppActivatedUser(db, user.userId);

    await db.identityAdminReviewDecision.create({
      data: {
        userId: user.userId,
        verificationSessionId: sessionId,
        status: "APPROVED",
        reasonCode: "TEST_APPROVAL",
      },
    });

    await db.user.update({
      where: { id: user.userId },
      data: {
        identityVerificationStatus: "EXPIRED",
        identityVerificationApprovedAt: null,
        identityVerificationValidUntil: new Date(Date.now() - 60_000),
        identityVerificationSessionId: null,
        adminReviewStatus: "NOT_READY",
        adminReviewVerificationSessionId: null,
        adminReviewDecidedAt: null,
      },
    });

    const profile = await request(app)
      .get("/v1/me/profile")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.legalNameLocked).toBe(true);

    const rename = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ lastName: "ExpiredBypass" });
    expect(rename.status).toBe(403);
  });

  it("T025E-E03 non-activated host hidden from discover after activation stripped", async () => {
    const viewer = await createIntegrationUser(app, emailSender, db, "t025e-viewer");
    const hiddenHost = await createIntegrationUser(app, emailSender, db, "t025e-host", {
      mainAppAccess: false,
    });
    await seedMainAppActivatedUser(db, hiddenHost.userId);
    const tag = `t025ehost${Date.now()}`;
    await db.profile.update({
      where: { userId: hiddenHost.userId },
      data: { displayName: tag },
    });

    const before = await request(app)
      .get(`/v1/discover/people?q=${encodeURIComponent(tag)}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(before.status).toBe(200);
    expect(
      before.body.data.people.some((p: { userId: string }) => p.userId === hiddenHost.userId),
    ).toBe(true);

    await db.user.update({
      where: { id: hiddenHost.userId },
      data: {
        adminReviewStatus: "REJECTED",
        adminReviewDecidedAt: new Date(),
      },
    });

    const after = await request(app)
      .get(`/v1/discover/people?q=${encodeURIComponent(tag)}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(after.status).toBe(200);
    expect(
      after.body.data.people.some((p: { userId: string }) => p.userId === hiddenHost.userId),
    ).toBe(false);
  });
});
