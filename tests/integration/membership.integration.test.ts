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

const defaultConsents = [
  { type: "TERMS", version: "pending-legal-review" },
  { type: "PRIVACY", version: "pending-legal-review" },
  { type: "AGE_ATTESTATION", version: "pending-legal-review" },
];

async function verifiedUser(
  app: ReturnType<typeof createApp>,
  emailSender: ReturnType<typeof createCapturingEmailSender>,
  prefix: string,
): Promise<{ accessToken: string; userId: string }> {
  const email = `${prefix}-${Date.now()}@example.com`;
  const register = await request(app).post("/v1/auth/register").send({
    firstName: "Mem",
    lastName: "Ber",
    email,
    password: "ValidPass1",
    dateOfBirth: "1995-06-15",
    consents: defaultConsents,
  });
  expect(register.status).toBe(201);
  const token = extractVerificationTokenFromText(emailSender.lastMessage?.text ?? "");
  expect(token).toBeTruthy();
  const confirm = await request(app).post("/v1/auth/email-verification/confirm").send({ token });
  expect(confirm.status).toBe(200);
  const login = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
  expect(login.status).toBe(200);
  return {
    accessToken: login.body.data.accessToken as string,
    userId: login.body.data.user.id as string,
  };
}

const describeMembership = runIntegration ? describe : describe.skip;

describeMembership("integration: membership plans & entitlements (Task 017)", () => {
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

  it("T017-M01 plan catalog requires auth and marks CLUB not purchasable", async () => {
    const unauth = await request(app).get("/v1/membership/plans");
    expect(unauth.status).toBe(401);

    const user = await verifiedUser(app, emailSender, "t017-plans");
    const res = await request(app)
      .get("/v1/membership/plans")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.billingConfigured).toBe(false);
    expect(res.body.data.commercialTermsApproved).toBe(false);
    const club = res.body.data.plans.find((p: { planId: string }) => p.planId === "CLUB");
    expect(club.purchasable).toBe(false);
    expect(club.pricing).toBeNull();
  });

  it("T017-M02 self membership is BASIC with no upgrade path", async () => {
    const user = await verifiedUser(app, emailSender, "t017-self");
    const res = await request(app)
      .get("/v1/me/membership")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.planId).toBe("BASIC");
    expect(res.body.data.canUpgrade).toBe(false);
    expect(res.body.data.subscription).toBeNull();
    expect(res.body.data.trial).toBeNull();
  });

  it("T017-M03 settings overview includes membership summary", async () => {
    const user = await verifiedUser(app, emailSender, "t017-settings");
    const res = await request(app)
      .get("/v1/me/settings/overview")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.membership.planId).toBe("BASIC");
    expect(res.body.data.capabilities.membershipPlanCatalog).toBe("LIVE");
    expect(res.body.data.capabilities.subscription).toBe("DEFERRED");
    expect(res.body.data.relatedRoutes.membership).toBe("GET /v1/me/membership");
  });

  it("T017-M04 no subscription purchase routes exposed", async () => {
    const user = await verifiedUser(app, emailSender, "t017-no-pay");
    const paths = [
      "/v1/membership/subscribe",
      "/v1/me/membership/upgrade",
      "/v1/me/membership/checkout",
    ];
    for (const path of paths) {
      const post = await request(app)
        .post(path)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ planId: "CLUB" });
      expect(post.status).toBe(404);
    }
  });

  it("T017-M05 cross-user isolation — only self membership readable", async () => {
    const a = await verifiedUser(app, emailSender, "t017-a");
    const b = await verifiedUser(app, emailSender, "t017-b");
    const resA = await request(app)
      .get("/v1/me/membership")
      .set("Authorization", `Bearer ${a.accessToken}`);
    const resB = await request(app)
      .get("/v1/me/membership")
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(resA.body.data.planId).toBe("BASIC");
    expect(resB.body.data.planId).toBe("BASIC");
    expect(resA.body.data.planId).toBe(resB.body.data.planId);
  });
});
