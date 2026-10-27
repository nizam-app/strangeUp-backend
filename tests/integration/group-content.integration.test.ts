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

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function verifiedUser(
  app: ReturnType<typeof createApp>,
  emailSender: ReturnType<typeof createCapturingEmailSender>,
  prefix: string,
): Promise<{ accessToken: string; userId: string }> {
  const email = `${prefix}-${Date.now()}@example.com`;
  const register = await request(app).post("/v1/auth/register").send({
    firstName: "Gc",
    lastName: "User",
    email,
    password: "ValidPass1",
    dateOfBirth: "1995-06-15",
    consents: defaultConsents,
  });
  expect(register.status).toBe(201);
  const token = extractVerificationTokenFromText(emailSender.lastMessage?.text ?? "");
  await request(app).post("/v1/auth/email-verification/confirm").send({ token });
  const login = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
  expect(login.status).toBe(200);
  return {
    accessToken: login.body.data.accessToken as string,
    userId: login.body.data.user.id as string,
  };
}

async function createPublicGroup(
  app: ReturnType<typeof createApp>,
  token: string,
): Promise<string> {
  const res = await request(app)
    .post("/v1/me/groups")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Media Group", category: "social", privacy: "PUBLIC" });
  expect(res.status).toBe(201);
  return res.body.data.groupId as string;
}

async function createPost(
  app: ReturnType<typeof createApp>,
  token: string,
  groupId: string,
  body = "hello",
): Promise<string> {
  const res = await request(app)
    .post(`/v1/groups/${groupId}/posts`)
    .set("Authorization", `Bearer ${token}`)
    .send({ body });
  expect(res.status).toBe(201);
  return res.body.data.postId as string;
}

const describeContent = runIntegration ? describe : describe.skip;

describeContent("integration: group stories, photo posts & polls (Task 016)", () => {
  let db: DatabaseClient;
  let appDisabled: ReturnType<typeof createApp>;
  let appEnabled: ReturnType<typeof createApp>;
  const emailSender = createCapturingEmailSender();

  beforeAll(() => {
    const url = process.env.INTEGRATION_DATABASE_URL?.trim();
    if (!url) {
      throw new Error("INTEGRATION_DATABASE_URL required");
    }
    db = createPrismaClient(url);
    const baseEnv = {
      NODE_ENV: "test" as const,
      DATABASE_URL: url,
      CORS_ORIGINS: "http://localhost:3000",
      JWT_ACCESS_SECRET: "test-jwt-access-secret-min-32-chars!!",
      PROFILE_UPLOAD_DIR: ".data/test-avatars",
      ACTIVITY_UPLOAD_DIR: ".data/test-activity-media",
      GROUP_UPLOAD_DIR: ".data/test-group-media",
    };
    appDisabled = createApp({
      env: loadEnv({ ...baseEnv, GROUP_COMMUNITY_INTERACTIVE_ENABLED: "false" }),
      logger: pino({ level: "silent" }),
      db,
      emailSender,
    });
    appEnabled = createApp({
      env: loadEnv({ ...baseEnv, GROUP_COMMUNITY_INTERACTIVE_ENABLED: "true" }),
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

  it("T016-G01 routes fail closed when GROUP_COMMUNITY_INTERACTIVE_ENABLED is false", async () => {
    const owner = await verifiedUser(appDisabled, emailSender, "t016-g01");
    const groupId = await createPublicGroup(appDisabled, owner.accessToken);
    const postId = await createPost(appDisabled, owner.accessToken, groupId);

    const media = await request(appDisabled)
      .post(`/v1/groups/${groupId}/posts/${postId}/media`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .attach("image", TINY_PNG, "photo.png");
    expect(media.status).toBe(403);
    expect(media.body.error.code).toBe("FEATURE_DISABLED");

    const story = await request(appDisabled)
      .post(`/v1/groups/${groupId}/stories`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .attach("image", TINY_PNG, "story.png");
    expect(story.status).toBe(403);
  });

  it("T016-P01 photo post attach, member read, nonmember 404", async () => {
    const owner = await verifiedUser(appEnabled, emailSender, "t016-p01o");
    const outsider = await verifiedUser(appEnabled, emailSender, "t016-p01x");
    const groupId = await createPublicGroup(appEnabled, owner.accessToken);
    const postId = await createPost(appEnabled, owner.accessToken, groupId);

    const attach = await request(appEnabled)
      .post(`/v1/groups/${groupId}/posts/${postId}/media`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .attach("image", TINY_PNG, "photo.png");
    expect(attach.status).toBe(201);
    const mediaId = attach.body.data.mediaId as string;

    const read = await request(appEnabled)
      .get(`/v1/groups/${groupId}/posts/${postId}/media/${mediaId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(read.status).toBe(200);
    expect(read.headers["content-type"]).toMatch(/^image\//);

    const strangerRead = await request(appEnabled)
      .get(`/v1/groups/${groupId}/posts/${postId}/media/${mediaId}`)
      .set("Authorization", `Bearer ${outsider.accessToken}`);
    expect(strangerRead.status).toBe(404);
  });

  it("T016-S01 story expires at read time", async () => {
    const owner = await verifiedUser(appEnabled, emailSender, "t016-s01");
    const groupId = await createPublicGroup(appEnabled, owner.accessToken);

    const created = await request(appEnabled)
      .post(`/v1/groups/${groupId}/stories`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .attach("image", TINY_PNG, "story.png");
    expect(created.status).toBe(201);
    const storyId = created.body.data.storyId as string;

    await db.communityGroupStory.update({
      where: { id: storyId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const media = await request(appEnabled)
      .get(`/v1/groups/${groupId}/stories/${storyId}/media`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(media.status).toBe(404);
  });

  it("T016-V01 poll single vote and duplicate conflict", async () => {
    const owner = await verifiedUser(appEnabled, emailSender, "t016-v01o");
    const voter = await verifiedUser(appEnabled, emailSender, "t016-v01v");
    const groupId = await createPublicGroup(appEnabled, owner.accessToken);
    await request(appEnabled)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${voter.accessToken}`);
    const postId = await createPost(appEnabled, owner.accessToken, groupId);

    const closesAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const pollRes = await request(appEnabled)
      .post(`/v1/groups/${groupId}/posts/${postId}/poll`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ closesAt, options: ["A", "B"] });
    expect(pollRes.status).toBe(201);
    const optionId = pollRes.body.data.options[0].optionId as string;

    const vote = await request(appEnabled)
      .put(`/v1/groups/${groupId}/posts/${postId}/poll/vote`)
      .set("Authorization", `Bearer ${voter.accessToken}`)
      .send({ optionId });
    expect(vote.status).toBe(200);
    expect(vote.body.data.myVoteOptionId).toBe(optionId);
    expect(vote.body.data.totalVotes).toBe(1);

    const dup = await request(appEnabled)
      .put(`/v1/groups/${groupId}/posts/${postId}/poll/vote`)
      .set("Authorization", `Bearer ${voter.accessToken}`)
      .send({ optionId: pollRes.body.data.options[1].optionId });
    expect(dup.status).toBe(409);
  });

  it("T016-H01 home stories remain DEFERRED regardless of interactive flag", async () => {
    const user = await verifiedUser(appEnabled, emailSender, "t016-h01");
    const home = await request(appEnabled)
      .get("/v1/home")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(home.status).toBe(200);
    expect(home.body.data.stories.status).toBe("DEFERRED");
  });
});
