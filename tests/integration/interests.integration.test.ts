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
import {
  createEmailVerifiedIntegrationUser,
  createIntegrationUser,
} from "../helpers/integration-user.js";
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";
import { INTEREST_CATALOG } from "../../src/modules/interests/interest-catalog.js";

const runIntegration = process.env.RUN_INTEGRATION === "1";

async function verifiedUser(
  app: ReturnType<typeof createApp>,
  emailSender: ReturnType<typeof createCapturingEmailSender>,
  db: DatabaseClient,
  emailPrefix: string,
  options?: { catalogOnly?: boolean },
): Promise<{ email: string; accessToken: string }> {
  if (options?.catalogOnly) {
    return createEmailVerifiedIntegrationUser(app, emailSender, emailPrefix);
  }
  const user = await createIntegrationUser(app, emailSender, db, emailPrefix);
  return { email: user.email, accessToken: user.accessToken };
}

const describeInterests = runIntegration ? describe : describe.skip;

describeInterests("integration: profile interests (Task 007)", () => {
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
    });
    app = createApp({
      env,
      logger: pino({ level: "silent" }),
      db,
      emailSender,
    });
  });

  beforeEach(async () => {
    clearRateLimits();
    emailSender.clear();
    await db.$executeRawUnsafe(`
      TRUNCATE TABLE
        "RegisterIdempotency",
        "AuthChallenge",
        "ConsentRecord",
        "UserInterest",
        "Session",
        "PasswordCredential",
        "Profile",
        "User"
      RESTART IDENTITY CASCADE;
    `);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("T007-P01 catalog is seeded and GET /v1/interests returns ordered catalog", async () => {
    const count = await db.interest.count();
    expect(count).toBe(10);

    const { accessToken } = await verifiedUser(app, emailSender, db, "catalog", {
      catalogOnly: true,
    });

    const catalog = await request(app)
      .get("/v1/interests")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(catalog.status).toBe(200);
    expect(catalog.body.data.interests).toEqual(
      INTEREST_CATALOG.map((e) => ({ slug: e.slug, label: e.label })),
    );
  });

  it("T007-P02 self selection round-trip, replace, clear, and idempotent PUT", async () => {
    const { accessToken } = await verifiedUser(app, emailSender, db, "interests-rt");

    const empty = await request(app)
      .get("/v1/me/interests")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(empty.status).toBe(200);
    expect(empty.body.data.interests).toEqual([]);

    const put = await request(app)
      .put("/v1/me/interests")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ interests: ["music", "biking", "travel"] });
    expect(put.status).toBe(200);
    expect(put.body.data.interests).toEqual([
      { slug: "music", label: "Music" },
      { slug: "biking", label: "Biking" },
      { slug: "travel", label: "Travel" },
    ]);

    const get = await request(app)
      .get("/v1/me/interests")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(get.body.data.interests).toEqual([
      { slug: "biking", label: "Biking" },
      { slug: "travel", label: "Travel" },
      { slug: "music", label: "Music" },
    ]);

    const replace = await request(app)
      .put("/v1/me/interests")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ interests: ["food"] });
    expect(replace.status).toBe(200);
    expect(replace.body.data.interests).toEqual([{ slug: "food", label: "Food" }]);

    const clear = await request(app)
      .put("/v1/me/interests")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ interests: [] });
    expect(clear.status).toBe(200);
    expect(clear.body.data.interests).toEqual([]);

    const repeat = await request(app)
      .put("/v1/me/interests")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ interests: [] });
    expect(repeat.status).toBe(200);
    expect(repeat.body.data.interests).toEqual([]);
  });

  it("T007-N01 validation rejects bad payloads without persisting", async () => {
    const { accessToken } = await verifiedUser(app, emailSender, db, "interests-bad");

    await request(app)
      .put("/v1/me/interests")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ interests: ["biking"] });

    const bad = await request(app)
      .put("/v1/me/interests")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ interests: ["not-a-slug"] });
    expect(bad.status).toBe(400);

    const get = await request(app)
      .get("/v1/me/interests")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(get.body.data.interests).toEqual([{ slug: "biking", label: "Biking" }]);
  });

  it("T007-S01 user A cannot read or overwrite user B selections", async () => {
    const userA = await verifiedUser(app, emailSender, db, "int-a");
    const userB = await verifiedUser(app, emailSender, db, "int-b");

    await request(app)
      .put("/v1/me/interests")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({ interests: ["hiking"] });

    const bGet = await request(app)
      .get("/v1/me/interests")
      .set("Authorization", `Bearer ${userB.accessToken}`);
    expect(bGet.body.data.interests).toEqual([]);

    await request(app)
      .put("/v1/me/interests")
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({ interests: ["music"] });

    const aGet = await request(app)
      .get("/v1/me/interests")
      .set("Authorization", `Bearer ${userA.accessToken}`);
    expect(aGet.body.data.interests).toEqual([{ slug: "hiking", label: "Hiking" }]);
  });

  it("T007-P03 pending user can read catalog; main-app /me/interests is denied", async () => {
    const { accessToken } = await createEmailVerifiedIntegrationUser(app, emailSender, "pending-int");

    const catalog = await request(app)
      .get("/v1/interests")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(catalog.status).toBe(200);

    const get = await request(app)
      .get("/v1/me/interests")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(get.status).toBe(403);
    expect(get.body.error.code).toBe("ONBOARDING_REQUIRED");

    const put = await request(app)
      .put("/v1/me/interests")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ interests: ["biking"] });
    expect(put.status).toBe(403);
    expect(put.body.error.code).toBe("ONBOARDING_REQUIRED");
  });

  it("T007-C01 concurrent PUT keeps a single consistent selection set", async () => {
    const { accessToken } = await verifiedUser(app, emailSender, db, "int-race");

    const [a, b] = await Promise.all([
      request(app)
        .put("/v1/me/interests")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ interests: ["biking", "music"] }),
      request(app)
        .put("/v1/me/interests")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ interests: ["travel", "food"] }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const get = await request(app)
      .get("/v1/me/interests")
      .set("Authorization", `Bearer ${accessToken}`);
    const slugs = (get.body.data.interests as Array<{ slug: string }>).map((i) => i.slug).sort();
    expect(slugs).toHaveLength(2);
    expect(new Set(slugs).size).toBe(2);
    const allowed = [
      ["biking", "music"],
      ["food", "travel"],
    ].map((s) => s.sort().join(","));
    expect(allowed).toContain(slugs.join(","));
  });

  it("T007-N02 unauthenticated catalog and self routes return 401", async () => {
    expect((await request(app).get("/v1/interests")).status).toBe(401);
    expect((await request(app).get("/v1/me/interests")).status).toBe(401);
    expect((await request(app).put("/v1/me/interests").send({ interests: [] })).status).toBe(401);
  });
});
