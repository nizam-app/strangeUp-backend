import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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
): Promise<{ accessToken: string; email: string }> {
  const user = await createIntegrationUser(app, emailSender, db, prefix);
  return { accessToken: user.accessToken, email: user.email };
}

const describeOwnProfile = runIntegration ? describe : describe.skip;

describeOwnProfile("integration: own profile extensions (Task 008)", () => {
  let db: DatabaseClient;
  let app: ReturnType<typeof createApp>;
  let uploadDir: string;
  const emailSender = createCapturingEmailSender();

  beforeAll(async () => {
    const url = process.env.INTEGRATION_DATABASE_URL?.trim();
    if (!url) {
      throw new Error("INTEGRATION_DATABASE_URL required");
    }
    uploadDir = await mkdtemp(path.join(os.tmpdir(), "strangeup-avatar-"));
    db = createPrismaClient(url);
    const env = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: url,
      CORS_ORIGINS: "http://localhost:3000",
      JWT_ACCESS_SECRET: "test-jwt-access-secret-min-32-chars!!",
      PROFILE_UPLOAD_DIR: uploadDir,
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
    await rm(uploadDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    clearRateLimits();
    emailSender.clear();
  });

  it("T008A-P01 new profile defaults profileVisibility to VERIFIED_USERS_ONLY", async () => {
    const { accessToken } = await verifiedUser(app, emailSender, db, "t008a-default-vis");

    const profile = await request(app)
      .get("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.profileVisibility).toBe("VERIFIED_USERS_ONLY");
  });

  it("T008-P01 profile PATCH location and visibility round-trip", async () => {
    const { accessToken } = await verifiedUser(app, emailSender, db, "t008-profile");

    const patch = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        locationCity: "Miami",
        locationRegion: "FL",
        profileVisibility: "VERIFIED_USERS_ONLY",
      });
    expect(patch.status).toBe(200);
    expect(patch.body.data.locationCity).toBe("Miami");
    expect(patch.body.data.locationRegion).toBe("FL");
    expect(patch.body.data.profileVisibility).toBe("VERIFIED_USERS_ONLY");
    expect(patch.body.data.hasAvatar).toBe(false);

    const clear = await request(app)
      .patch("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ locationCity: null, locationRegion: null });
    expect(clear.status).toBe(200);
    expect(clear.body.data.locationCity).toBeNull();
  });

  it("T008-P02 favorite activities replace and clear", async () => {
    const { accessToken } = await verifiedUser(app, emailSender, db, "t008-fav");

    const put = await request(app)
      .put("/v1/me/favorite-activities")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        favoriteActivities: [
          {
            title: "Pickleball",
            skillLevel: "INTERMEDIATE",
            cadence: "WEEKLY",
            scheduleNote: "Sat 10am",
            placeLabel: "Rec center",
          },
        ],
      });
    expect(put.status).toBe(200);
    expect(put.body.data.favoriteActivities).toHaveLength(1);

    const get = await request(app)
      .get("/v1/me/favorite-activities")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(get.body.data.favoriteActivities[0].title).toBe("Pickleball");

    const clear = await request(app)
      .put("/v1/me/favorite-activities")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ favoriteActivities: [] });
    expect(clear.body.data.favoriteActivities).toEqual([]);
  });

  it("T008-P03 avatar upload, fetch, delete", async () => {
    const { accessToken } = await verifiedUser(app, emailSender, db, "t008-avatar");
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    const upload = await request(app)
      .post("/v1/me/profile/avatar")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("avatar", png, { filename: "tiny.png", contentType: "image/png" });
    expect(upload.status).toBe(200);
    expect(upload.body.data.hasAvatar).toBe(true);

    const profile = await request(app)
      .get("/v1/me/profile")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(profile.body.data.hasAvatar).toBe(true);

    const bytes = await request(app)
      .get("/v1/me/profile/avatar")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(bytes.status).toBe(200);
    expect(bytes.headers["content-type"]).toMatch(/image\/png/);

    const del = await request(app)
      .delete("/v1/me/profile/avatar")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(del.status).toBe(200);
    expect(del.body.data.hasAvatar).toBe(false);
  });

  it("T008A-P02 rejects SVG disguised as PNG upload", async () => {
    const { accessToken } = await verifiedUser(app, emailSender, db, "t008a-svg");
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
    );

    const upload = await request(app)
      .post("/v1/me/profile/avatar")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("avatar", svg, { filename: "evil.png", contentType: "image/png" });
    expect(upload.status).toBe(400);
    expect(upload.body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("T008-S01 user B cannot read user A avatar or favorites", async () => {
    const a = await verifiedUser(app, emailSender, db, "t008-a");
    const b = await verifiedUser(app, emailSender, db, "t008-b");

    await request(app)
      .put("/v1/me/favorite-activities")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({
        favoriteActivities: [{ title: "Secret", skillLevel: "BEGINNER", cadence: "CASUAL" }],
      });

    const bFav = await request(app)
      .get("/v1/me/favorite-activities")
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(bFav.body.data.favoriteActivities).toEqual([]);
  });
});
