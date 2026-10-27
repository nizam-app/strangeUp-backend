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
  db: DatabaseClient,
  prefix: string,
  options?: { visibility?: "EVERYONE" | "VERIFIED_USERS_ONLY"; kyc?: "APPROVED" | "NOT_STARTED" },
): Promise<{ accessToken: string; userId: string; email: string }> {
  const email = `${prefix}-${Date.now()}@example.com`;
  const register = await request(app).post("/v1/auth/register").send({
    firstName: "Disc",
    lastName: "User",
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
  const userId = login.body.data.user.id as string;

  if (options?.visibility) {
    await db.profile.update({
      where: { userId },
      data: { profileVisibility: options.visibility },
    });
  }
  if (options?.kyc === "APPROVED") {
    await db.user.update({
      where: { id: userId },
      data: { identityVerificationStatus: "APPROVED" },
    });
  }

  return { accessToken: login.body.data.accessToken as string, userId, email };
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

    const list = await request(app)
      .get("/v1/discover/people")
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

  it("T009-P02 VERIFIED_USERS_ONLY hidden without KYC; visible with APPROVED", async () => {
    const viewer = await verifiedUser(app, emailSender, db, "t009-nokyc");
    const target = await verifiedUser(app, emailSender, db, "t009-vuo", {
      visibility: "VERIFIED_USERS_ONLY",
    });

    const hidden = await request(app)
      .get(`/v1/users/${target.userId}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(hidden.status).toBe(404);

    await db.user.update({
      where: { id: viewer.userId },
      data: { identityVerificationStatus: "APPROVED" },
    });
    const login = await request(app)
      .post("/v1/auth/login")
      .send({ email: viewer.email, password: "ValidPass1" });
    const token = login.body.data.accessToken as string;

    const visible = await request(app)
      .get(`/v1/users/${target.userId}`)
      .set("Authorization", `Bearer ${token}`);
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
});
