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
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";

async function verifiedUser(
  app: ReturnType<typeof createApp>,
  emailSender: ReturnType<typeof createCapturingEmailSender>,
  db: DatabaseClient,
  prefix: string,
  options?: {
    visibility?: "EVERYONE" | "VERIFIED_USERS_ONLY";
    mainAppAccess?: boolean;
  },
): Promise<{ accessToken: string; userId: string; email: string }> {
  const user = await createIntegrationUser(app, emailSender, db, prefix, {
    profileVisibility: options?.visibility,
    mainAppAccess: options?.mainAppAccess,
  });
  return user;
}

const describeDiscovery = runIntegration ? describe : describe.skip;

describeDiscovery("integration: discovery & public profiles (Task 009)", () => {
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

  it("T009-P01 eligible viewer sees EVERYONE target on discover and detail", async () => {
    const viewer = await verifiedUser(app, emailSender, db, "t009-viewer");
    const target = await verifiedUser(app, emailSender, db, "t009-everyone", {
      visibility: "EVERYONE",
    });
    const searchTag = `t009disc${Date.now()}`;
    await db.profile.update({
      where: { userId: target.userId },
      data: { displayName: searchTag },
    });

    const list = await request(app)
      .get(`/v1/discover/people?q=${encodeURIComponent(searchTag)}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.people.some((p: { userId: string }) => p.userId === target.userId)).toBe(
      true,
    );

    const detail = await request(app)
      .get(`/v1/users/${target.userId}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.userId).toBe(target.userId);
    expect(detail.body.data.birthDate).toBeUndefined();
    expect(detail.body.data.email).toBeUndefined();
  });

  it("T009-P02 pending viewer denied main app; activated viewer sees VERIFIED_USERS_ONLY", async () => {
    const pendingViewer = await verifiedUser(app, emailSender, db, "t009-nokyc", {
      mainAppAccess: false,
    });
    const target = await verifiedUser(app, emailSender, db, "t009-vuo", {
      visibility: "VERIFIED_USERS_ONLY",
    });

    const denied = await request(app)
      .get(`/v1/users/${target.userId}`)
      .set("Authorization", `Bearer ${pendingViewer.accessToken}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("ONBOARDING_REQUIRED");
    expect(denied.body.error.homeAccessAllowed).toBe(false);

    const activatedViewer = await verifiedUser(app, emailSender, db, "t009-kyc-viewer");
    const visible = await request(app)
      .get(`/v1/users/${target.userId}`)
      .set("Authorization", `Bearer ${activatedViewer.accessToken}`);
    expect(visible.status).toBe(200);
  });

  it("T009-S01 bidirectional block yields generic 404 on detail", async () => {
    const a = await verifiedUser(app, emailSender, db, "t009-a", { visibility: "EVERYONE" });
    const b = await verifiedUser(app, emailSender, db, "t009-b", { visibility: "EVERYONE" });

    const block = await request(app)
      .post("/v1/me/blocks")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ targetUserId: b.userId });
    expect(block.status).toBe(200);

    const detail = await request(app)
      .get(`/v1/users/${b.userId}`)
      .set("Authorization", `Bearer ${a.accessToken}`);
    expect(detail.status).toBe(404);
  });

  it("T009-N01 unauthenticated discover returns 401", async () => {
    const res = await request(app).get("/v1/discover/people");
    expect(res.status).toBe(401);
  });

  it("T025B-P01 email-verified pending activation never appears as discover target", async () => {
    const viewer = await verifiedUser(app, emailSender, db, "t025b-viewer");
    const pending = await verifiedUser(app, emailSender, db, "t025b-pending", {
      mainAppAccess: false,
    });
    const tag = `t025bpending${Date.now()}`;
    await db.profile.update({
      where: { userId: pending.userId },
      data: { displayName: tag },
    });

    const list = await request(app)
      .get(`/v1/discover/people?q=${encodeURIComponent(tag)}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.people.some((p: { userId: string }) => p.userId === pending.userId)).toBe(
      false,
    );

    const detail = await request(app)
      .get(`/v1/users/${pending.userId}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(detail.status).toBe(404);
  });

  it("T025B-P02 provider-approved admin-pending user hidden from discover", async () => {
    const viewer = await verifiedUser(app, emailSender, db, "t025b-v2");
    const applicant = await verifiedUser(app, emailSender, db, "t025b-applicant", {
      mainAppAccess: false,
    });
    const tag = `t025badminpending${Date.now()}`;
    await db.profile.update({
      where: { userId: applicant.userId },
      data: { displayName: tag },
    });

    const { randomUUID } = await import("node:crypto");
    const { seedProviderApprovedApplicant } = await import("../helpers/kyc-applicant.js");
    const sessionId = randomUUID();
    await seedProviderApprovedApplicant(db, applicant.userId, sessionId, `mock-ref-${sessionId}`);

    const list = await request(app)
      .get(`/v1/discover/people?q=${encodeURIComponent(tag)}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(list.status).toBe(200);
    expect(
      list.body.data.people.some((p: { userId: string }) => p.userId === applicant.userId),
    ).toBe(false);
  });
});
