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
  db: DatabaseClient,
  prefix: string,
  options?: { visibility?: "EVERYONE" | "VERIFIED_USERS_ONLY"; kyc?: "APPROVED" },
): Promise<{ accessToken: string; userId: string }> {
  const email = `${prefix}-${Date.now()}@example.com`;
  const register = await request(app).post("/v1/auth/register").send({
    firstName: "Grp",
    lastName: "User",
    email,
    password: "ValidPass1",
    dateOfBirth: "1995-06-15",
    consents: defaultConsents,
  });
  expect(register.status).toBe(201);
  const token = extractVerificationTokenFromText(emailSender.lastMessage?.text ?? "");
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
  return { accessToken: login.body.data.accessToken as string, userId };
}

const describeGroups = runIntegration ? describe : describe.skip;

describeGroups("integration: groups & communities (Task 012)", () => {
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
      GROUP_UPLOAD_DIR: ".data/test-group-media",
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

  it("T012-P01 creates PUBLIC and PRIVATE groups with bounded fields and owner membership", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t012-p01");
    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        name: "x".repeat(60),
        description: "Morning community",
        category: "sports",
        locationCity: "Miami",
        locationRegion: "FL",
        privacy: "PUBLIC",
        meetupFrequency: "WEEKLY",
        memberCapacity: 3,
        tags: ["miami", "sunrise"],
      });
    expect(created.status).toBe(201);
    expect(created.body.data.myMembership).toEqual({ status: "ACTIVE", role: "OWNER" });
    expect(created.body.data.memberCount).toBe(1);
    expect(created.body.data).not.toHaveProperty("verified");
    expect(created.body.data.name).toHaveLength(60);

    const tooLong = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "x".repeat(61), category: "sports", privacy: "PUBLIC" });
    expect(tooLong.status).toBe(400);

    const privateGroup = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Private Club", category: "social", privacy: "PRIVATE_APPROVAL" });
    expect(privateGroup.status).toBe(201);
    expect(privateGroup.body.data.privacy).toBe("PRIVATE_APPROVAL");
  });

  it("T012-P02 public join is immediate; private join stays pending; strangers cannot approve", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t012-p02o");
    const member = await verifiedUser(app, emailSender, db, "t012-p02m");
    const stranger = await verifiedUser(app, emailSender, db, "t012-p02s");

    const pub = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Public Join", category: "fitness", privacy: "PUBLIC" });
    const priv = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Private Join", category: "fitness", privacy: "PRIVATE_APPROVAL" });

    const publicJoin = await request(app)
      .post(`/v1/groups/${pub.body.data.groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(publicJoin.body.data.status).toBe("ACTIVE");

    const privateJoin = await request(app)
      .post(`/v1/groups/${priv.body.data.groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(privateJoin.body.data.status).toBe("PENDING");
    expect(privateJoin.body.data.role).toBeNull();

    const requests = await request(app)
      .get(`/v1/me/groups/${priv.body.data.groupId}/join-requests`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(requests.status).toBe(200);
    const membershipId = requests.body.data.requests[0].membershipId as string;

    const strangerApprove = await request(app)
      .post(`/v1/me/groups/${priv.body.data.groupId}/join-requests/${membershipId}/approve`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(strangerApprove.status).toBe(404);

    const approve = await request(app)
      .post(`/v1/me/groups/${priv.body.data.groupId}/join-requests/${membershipId}/approve`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(approve.body.data.status).toBe("ACTIVE");

    const ownerLeave = await request(app)
      .delete(`/v1/groups/${pub.body.data.groupId}/join`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(ownerLeave.status).toBe(403);
  });

  it("T012-C01 concurrent last-seat joins never exceed capacity", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t012-c01o");
    const a = await verifiedUser(app, emailSender, db, "t012-c01a");
    const b = await verifiedUser(app, emailSender, db, "t012-c01b");
    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Tiny Club", category: "social", privacy: "PUBLIC", memberCapacity: 2 });
    const groupId = created.body.data.groupId as string;

    const [first, second] = await Promise.all([
      request(app)
        .post(`/v1/groups/${groupId}/join`)
        .set("Authorization", `Bearer ${a.accessToken}`),
      request(app)
        .post(`/v1/groups/${groupId}/join`)
        .set("Authorization", `Bearer ${b.accessToken}`),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const active = await db.communityMembership.count({
      where: { groupId, status: "ACTIVE" },
    });
    expect(active).toBe(2);
  });

  it("T012-P03 discovery shows private summaries and hides private content", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t012-p03o");
    const outsider = await verifiedUser(app, emailSender, db, "t012-p03x");
    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        name: "Hidden Posts Club",
        category: "hobbies",
        privacy: "PRIVATE_APPROVAL",
        locationCity: "Austin",
      });
    const groupId = created.body.data.groupId as string;

    const list = await request(app)
      .get("/v1/groups?q=Hidden&privacy=PRIVATE_APPROVAL")
      .set("Authorization", `Bearer ${outsider.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.groups.some((g: { groupId: string }) => g.groupId === groupId)).toBe(
      true,
    );
    expect(list.body.data.groups[0]).not.toHaveProperty("distanceMiles");
    expect(list.body.data.groups[0].memberCount).toBe(1);

    const detail = await request(app)
      .get(`/v1/groups/${groupId}`)
      .set("Authorization", `Bearer ${outsider.accessToken}`);
    expect(detail.body.data.canAccessContent).toBe(false);

    const posts = await request(app)
      .get(`/v1/groups/${groupId}/posts`)
      .set("Authorization", `Bearer ${outsider.accessToken}`);
    expect(posts.status).toBe(404);

    const members = await request(app)
      .get(`/v1/groups/${groupId}/members`)
      .set("Authorization", `Bearer ${outsider.accessToken}`);
    expect(members.status).toBe(404);
  });

  it("T012-P04 posts, likes, comments and pins stay member-gated", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t012-p04o", { visibility: "EVERYONE" });
    const member = await verifiedUser(app, emailSender, db, "t012-p04m", {
      visibility: "EVERYONE",
    });
    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Talk Club", category: "social", privacy: "PUBLIC" });
    const groupId = created.body.data.groupId as string;
    await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);

    const post = await request(app)
      .post(`/v1/groups/${groupId}/posts`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ body: "First ride recap" });
    expect(post.status).toBe(201);
    const postId = post.body.data.postId as string;

    const like = await request(app)
      .put(`/v1/groups/${groupId}/posts/${postId}/like`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    const likeAgain = await request(app)
      .put(`/v1/groups/${groupId}/posts/${postId}/like`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(like.status).toBe(200);
    expect(likeAgain.status).toBe(200);

    const comment = await request(app)
      .post(`/v1/groups/${groupId}/posts/${postId}/comments`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ body: "Nice" });
    expect(comment.status).toBe(201);

    const pin = await request(app)
      .post(`/v1/groups/${groupId}/posts/${postId}/pin`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ pinned: true });
    expect(pin.body.data.pinned).toBe(true);

    const memberPin = await request(app)
      .post(`/v1/groups/${groupId}/posts/${postId}/pin`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ pinned: false });
    expect(memberPin.status).toBe(404);
  });

  it("T012-P05 cover upload is Sharp-validated and private groups do not leak bytes", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t012-p05o");
    const outsider = await verifiedUser(app, emailSender, db, "t012-p05x");
    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Cover Club", category: "outdoor", privacy: "PRIVATE_APPROVAL" });
    const groupId = created.body.data.groupId as string;

    const bad = await request(app)
      .post(`/v1/me/groups/${groupId}/cover`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .attach("cover", Buffer.from("not-an-image"), "cover.png");
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .post(`/v1/me/groups/${groupId}/cover`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .attach("cover", TINY_PNG, "cover.png");
    expect(ok.status).toBe(200);
    expect(ok.body.data.hasCover).toBe(true);

    const leaked = await request(app)
      .get(`/v1/groups/${groupId}/cover`)
      .set("Authorization", `Bearer ${outsider.accessToken}`);
    expect(leaked.status).toBe(404);
  });

  it("T012-P06 group chat requires current membership and stays off DirectConversation", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t012-p06o", { visibility: "EVERYONE" });
    const member = await verifiedUser(app, emailSender, db, "t012-p06m", {
      visibility: "EVERYONE",
    });
    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Chat Club", category: "social", privacy: "PUBLIC" });
    const groupId = created.body.data.groupId as string;
    await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);

    const clientMessageId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const send = await request(app)
      .post(`/v1/groups/${groupId}/chat/messages`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ body: "hello group", clientMessageId });
    const sendAgain = await request(app)
      .post(`/v1/groups/${groupId}/chat/messages`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ body: "hello group", clientMessageId });
    expect(send.status).toBe(201);
    expect(sendAgain.body.data.messageId).toBe(send.body.data.messageId);

    const read = await request(app)
      .post(`/v1/groups/${groupId}/chat/read`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({});
    expect(read.body.data.unreadCount).toBe(0);

    await request(app)
      .delete(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    const afterLeave = await request(app)
      .post(`/v1/groups/${groupId}/chat/messages`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ body: "still here?" });
    expect(afterLeave.status).toBe(404);

    const dms = await request(app)
      .get("/v1/me/conversations")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(dms.body.data.conversations).toEqual([]);
  });

  it("T012-P07 blocks redact previews and hide blocked-authored content", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t012-p07o", { visibility: "EVERYONE" });
    const member = await verifiedUser(app, emailSender, db, "t012-p07m", {
      visibility: "EVERYONE",
    });
    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Block Club", category: "social", privacy: "PUBLIC" });
    const groupId = created.body.data.groupId as string;
    await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    await request(app)
      .post(`/v1/groups/${groupId}/posts`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ body: "secret note" });

    await request(app)
      .post("/v1/me/blocks")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ targetUserId: member.userId });

    const stillMember = await db.communityMembership.findUnique({
      where: { groupId_userId: { groupId, userId: member.userId } },
    });
    expect(stillMember?.status).toBe("ACTIVE");

    const posts = await request(app)
      .get(`/v1/groups/${groupId}/posts`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(posts.body.data.posts).toEqual([]);

    const roster = await request(app)
      .get(`/v1/groups/${groupId}/members`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    const blockedPreview = roster.body.data.members.find(
      (row: { user: { userId: string; displayName: string | null } }) =>
        row.user.userId === member.userId,
    );
    expect(blockedPreview.user.displayName).toBeNull();
  });

  it("T012-P08 group membership is not an activity RSVP and cannot leak meeting instructions", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t012-p08o", { kyc: "APPROVED" });
    const member = await verifiedUser(app, emailSender, db, "t012-p08m");
    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Meetup Club", category: "sports", privacy: "PUBLIC" });
    const groupId = created.body.data.groupId as string;
    await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);

    const starts = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const draft = await request(app)
      .post("/v1/me/activities")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        title: "Club ride",
        category: "biking",
        startsAt: starts.toISOString(),
        endsAt: new Date(starts.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        timeZone: "America/New_York",
        mode: "IN_PERSON",
        venueName: "Bayfront Park",
        locationCity: "Miami",
        locationRegion: "FL",
        meetingInstructions: "Meet at the south fountain",
        capacity: 4,
      });
    expect(draft.status).toBe(201);
    const activityId = draft.body.data.activityId as string;
    const publish = await request(app)
      .post(`/v1/me/activities/${activityId}/publish`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(publish.status).toBe(200);

    const attach = await request(app)
      .post(`/v1/me/groups/${groupId}/activities`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ activityId });
    expect(attach.status).toBe(200);

    const listed = await request(app)
      .get(`/v1/groups/${groupId}/activities`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.activities[0].activityId).toBe(activityId);
    expect(listed.body.data.activities[0]).not.toHaveProperty("meetingInstructions");

    const rsvps = await request(app)
      .get("/v1/me/activity-rsvps")
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(rsvps.body.data.rsvps).toEqual([]);
  });
});
