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

const describe025d = runIntegration ? describe : describe.skip;

describe025d("integration: main flow 025D profile & settings (Task 025D)", () => {
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

  it("T025D-P01 pending user can PATCH profile bio but not access settings hub", async () => {
    const pending = await createIntegrationUser(app, emailSender, db, "t025d-pending", {
      mainAppAccess: false,
    });
    const patch = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${pending.accessToken}`)
      .send({ bio: "Pre-home bio" });
    expect(patch.status).toBe(200);

    const hub = await request(app)
      .get("/v1/me/settings/overview")
      .set("Authorization", `Bearer ${pending.accessToken}`);
    expect(hub.status).toBe(403);
    expect(hub.body.error.code).toBe("ONBOARDING_REQUIRED");
  });

  it("T025D-P02 activated user cannot PATCH legal name after KYC; bio still allowed", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "t025d-kyc");
    const profileBefore = await request(app)
      .get("/v1/me/profile")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(profileBefore.status).toBe(200);
    expect(profileBefore.body.data.legalNameLocked).toBe(true);

    const rename = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ firstName: "Changed", lastName: "Identity" });
    expect(rename.status).toBe(403);
    expect(rename.body.error.code).toBe("AUTH_FORBIDDEN");

    const bio = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ bio: "Still editable" });
    expect(bio.status).toBe(200);
    expect(bio.body.data.bio).toBe("Still editable");
  });

  it("T025D-P03 settings overview exposes truthful activation fields; no fake ratings", async () => {
    const user = await createIntegrationUser(app, emailSender, db, "t025d-hub");
    const hub = await request(app)
      .get("/v1/me/settings/overview")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(hub.status).toBe(200);
    expect(hub.body.data.account.adminReviewStatus).toBe("APPROVED");
    expect(hub.body.data.account.legalNameLocked).toBe(true);
    expect(hub.body.data.account.fullAccess).toBe(true);
    expect(hub.body.data).not.toHaveProperty("rating");
    expect(hub.body.data.capabilities.twoFactorAuth).toBe("DEFERRED");
    expect(hub.body.data.capabilities.meetupInvites).toBe("DEFERRED");
    expect(hub.body.data.capabilities.accountDeletion).toBe("UNAVAILABLE");
    expect(typeof hub.body.data.counts.confirmedUpcomingRsvps).toBe("number");
  });
});
