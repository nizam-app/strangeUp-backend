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

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function verifiedUser(
  app: ReturnType<typeof createApp>,
  emailSender: ReturnType<typeof createCapturingEmailSender>,
  db: DatabaseClient,
  prefix: string,
  options?: {
    visibility?: "EVERYONE" | "VERIFIED_USERS_ONLY";
    mainAppAccess?: boolean;
  },
): Promise<{ accessToken: string; userId: string }> {
  const user = await createIntegrationUser(app, emailSender, db, prefix, {
    profileVisibility: options?.visibility,
    mainAppAccess: options?.mainAppAccess,
  });
  return { accessToken: user.accessToken, userId: user.userId };
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
    const owner = await verifiedUser(app, emailSender, db, "t012-p08o");
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

  it("T029B-P01 my groups inventory views partition memberships truthfully", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t029b-p01o");
    const member = await verifiedUser(app, emailSender, db, "t029b-p01m");
    const mod = await verifiedUser(app, emailSender, db, "t029b-p01mod");

    const owned = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Owner Alpha Club", category: "sports", privacy: "PUBLIC" });
    expect(owned.status).toBe(201);
    const ownedId = owned.body.data.groupId as string;

    const managed = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Mod Beta Circle", category: "social", privacy: "PUBLIC" });
    expect(managed.status).toBe(201);
    const managedId = managed.body.data.groupId as string;
    await request(app)
      .post(`/v1/groups/${managedId}/join`)
      .set("Authorization", `Bearer ${mod.accessToken}`);
    await request(app)
      .post(`/v1/me/groups/${managedId}/members/${mod.userId}/role`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ role: "MODERATOR" });

    await request(app)
      .post(`/v1/groups/${ownedId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);

    const pendingGroup = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Pending Private", category: "hobbies", privacy: "PRIVATE_APPROVAL" });
    expect(pendingGroup.status).toBe(201);
    const pendingId = pendingGroup.body.data.groupId as string;
    await request(app)
      .post(`/v1/groups/${pendingId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);

    const ownerAll = await request(app)
      .get("/v1/me/groups?view=all")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(ownerAll.status).toBe(200);
    expect(ownerAll.body.data.groups.map((g: { groupId: string }) => g.groupId).sort()).toEqual(
      [ownedId, managedId, pendingId].sort(),
    );

    const managedView = await request(app)
      .get("/v1/me/groups?view=managed")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(managedView.status).toBe(200);
    expect(managedView.body.data.groups.map((g: { groupId: string }) => g.groupId).sort()).toEqual(
      [ownedId, managedId, pendingId].sort(),
    );

    const modManaged = await request(app)
      .get("/v1/me/groups?view=managed")
      .set("Authorization", `Bearer ${mod.accessToken}`);
    expect(modManaged.body.data.groups.map((g: { groupId: string }) => g.groupId)).toEqual([
      managedId,
    ]);

    const memberJoined = await request(app)
      .get("/v1/me/groups?view=joined")
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(memberJoined.status).toBe(200);
    expect(memberJoined.body.data.groups.map((g: { groupId: string }) => g.groupId)).toEqual([
      ownedId,
    ]);

    const memberPending = await request(app)
      .get("/v1/me/groups?view=pending")
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(memberPending.status).toBe(200);
    expect(memberPending.body.data.groups.map((g: { groupId: string }) => g.groupId)).toEqual([
      pendingId,
    ]);

    const search = await request(app)
      .get("/v1/me/groups?view=all&q=Alpha")
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(search.status).toBe(200);
    expect(search.body.data.groups).toHaveLength(1);
    expect(search.body.data.groups[0].groupId).toBe(ownedId);
  });

  it("T029B-P02 private groups remain discoverable summaries; non-members cannot read posts", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t029b-p02o");
    const stranger = await verifiedUser(app, emailSender, db, "t029b-p02s");

    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Hidden-ish Social", category: "social", privacy: "PRIVATE_APPROVAL" });
    expect(created.status).toBe(201);
    const groupId = created.body.data.groupId as string;

    const discover = await request(app)
      .get("/v1/groups?privacy=PRIVATE_APPROVAL")
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(discover.status).toBe(200);
    expect(discover.body.data.groups.some((g: { groupId: string }) => g.groupId === groupId)).toBe(
      true,
    );

    const detail = await request(app)
      .get(`/v1/groups/${groupId}`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.canAccessContent).toBe(false);

    const posts = await request(app)
      .get(`/v1/groups/${groupId}/posts`)
      .set("Authorization", `Bearer ${stranger.accessToken}`);
    expect(posts.status).toBe(404);
  });

  it("T029C-P01 create and manage reflect Figma-aligned fields without fabricated stats", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t029c-p01o");
    const mod = await verifiedUser(app, emailSender, db, "t029c-p01mod");

    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        name: "Miami Sunrise Run & Cycle",
        description: "Morning strides and coastal sunrises.",
        category: "outdoor",
        locationCity: "Miami Beach",
        locationRegion: "FL",
        privacy: "PUBLIC",
        meetupFrequency: "WEEKLY",
        memberCapacity: 50,
        tags: ["morningcrew", "outdoor-fitness"],
      });
    expect(created.status).toBe(201);
    const groupId = created.body.data.groupId as string;
    expect(created.body.data).toMatchObject({
      privacy: "PUBLIC",
      meetupFrequency: "WEEKLY",
      memberCapacity: 50,
      memberCount: 1,
      spotsLeft: 49,
    });
    expect(created.body.data.tags).toEqual(["morningcrew", "outdoor-fitness"]);
    expect(created.body.data).not.toHaveProperty("verified");

    await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${mod.accessToken}`);
    await request(app)
      .post(`/v1/me/groups/${groupId}/members/${mod.userId}/role`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ role: "MODERATOR" });

    const modPatchName = await request(app)
      .patch(`/v1/me/groups/${groupId}`)
      .set("Authorization", `Bearer ${mod.accessToken}`)
      .send({ name: "Sunrise Run Club" });
    expect(modPatchName.status).toBe(200);

    const modPatchPrivacy = await request(app)
      .patch(`/v1/me/groups/${groupId}`)
      .set("Authorization", `Bearer ${mod.accessToken}`)
      .send({ privacy: "PUBLIC" });
    expect(modPatchPrivacy.status).toBe(403);

    const manage = await request(app)
      .get(`/v1/me/groups/${groupId}/manage`)
      .set("Authorization", `Bearer ${mod.accessToken}`);
    expect(manage.status).toBe(200);
    expect(manage.body.data.memberCount).toBe(2);
    expect(manage.body.data.pendingRequestCount).toBe(0);
    expect(manage.body.data.visiblePostCount).toBe(0);
    expect(manage.body.data).not.toHaveProperty("weeklyMemberGrowth");
  });

  it("T029C-P02 concurrent approvals respect last open seat", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t029c-p02o");
    const a = await verifiedUser(app, emailSender, db, "t029c-p02a");
    const b = await verifiedUser(app, emailSender, db, "t029c-p02b");

    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        name: "One Seat Club",
        category: "social",
        privacy: "PRIVATE_APPROVAL",
        memberCapacity: 2,
      });
    const groupId = created.body.data.groupId as string;

    await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${a.accessToken}`);
    await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${b.accessToken}`);

    const requests = await request(app)
      .get(`/v1/me/groups/${groupId}/join-requests`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    const ids = requests.body.data.requests.map(
      (r: { membershipId: string }) => r.membershipId,
    ) as string[];
    expect(ids).toHaveLength(2);

    const [first, second] = await Promise.all([
      request(app)
        .post(`/v1/me/groups/${groupId}/join-requests/${ids[0]}/approve`)
        .set("Authorization", `Bearer ${owner.accessToken}`),
      request(app)
        .post(`/v1/me/groups/${groupId}/join-requests/${ids[1]}/approve`)
        .set("Authorization", `Bearer ${owner.accessToken}`),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const active = await db.communityMembership.count({ where: { groupId, status: "ACTIVE" } });
    expect(active).toBe(2);
  });

  it("T029C-P03 archived groups reject settings and cover mutations", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t029c-p03o");
    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Archive Me", category: "hobbies", privacy: "PUBLIC" });
    const groupId = created.body.data.groupId as string;

    const archived = await request(app)
      .post(`/v1/me/groups/${groupId}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(archived.status).toBe(200);

    const patch = await request(app)
      .patch(`/v1/me/groups/${groupId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Should Fail" });
    expect(patch.status).toBe(403);

    const cover = await request(app)
      .post(`/v1/me/groups/${groupId}/cover`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .attach("cover", TINY_PNG, { filename: "cover.png", contentType: "image/png" });
    expect(cover.status).toBe(403);
  });

  it("T029C-P04 private group cover is member-only; capacity cannot drop below active count", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t029c-p04o");
    const member = await verifiedUser(app, emailSender, db, "t029c-p04m");
    const member2 = await verifiedUser(app, emailSender, db, "t029c-p04m2");
    const outsider = await verifiedUser(app, emailSender, db, "t029c-p04x");

    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({
        name: "Private Cover",
        category: "social",
        privacy: "PRIVATE_APPROVAL",
        memberCapacity: 4,
      });
    const groupId = created.body.data.groupId as string;

    const upload = await request(app)
      .post(`/v1/me/groups/${groupId}/cover`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .attach("cover", TINY_PNG, { filename: "cover.png", contentType: "image/png" });
    expect(upload.status).toBe(200);

    const outsiderCover = await request(app)
      .get(`/v1/groups/${groupId}/cover`)
      .set("Authorization", `Bearer ${outsider.accessToken}`);
    expect(outsiderCover.status).toBe(404);

    for (const token of [member.accessToken, member2.accessToken]) {
      await request(app)
        .post(`/v1/groups/${groupId}/join`)
        .set("Authorization", `Bearer ${token}`);
    }
    const requests = await request(app)
      .get(`/v1/me/groups/${groupId}/join-requests`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    for (const row of requests.body.data.requests as { membershipId: string }[]) {
      await request(app)
        .post(`/v1/me/groups/${groupId}/join-requests/${row.membershipId}/approve`)
        .set("Authorization", `Bearer ${owner.accessToken}`);
    }

    const memberCover = await request(app)
      .get(`/v1/groups/${groupId}/cover`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(memberCover.status).toBe(200);

    const shrink = await request(app)
      .patch(`/v1/me/groups/${groupId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ memberCapacity: 2 });
    expect(shrink.status).toBe(403);
  });

  it("T029B-P03 non-activated accounts cannot list groups or my inventory", async () => {
    const blocked = await verifiedUser(app, emailSender, db, "t029b-p03", {
      mainAppAccess: false,
    });
    const discover = await request(app)
      .get("/v1/groups")
      .set("Authorization", `Bearer ${blocked.accessToken}`);
    expect(discover.status).toBe(403);

    const mine = await request(app)
      .get("/v1/me/groups")
      .set("Authorization", `Bearer ${blocked.accessToken}`);
    expect(mine.status).toBe(403);
  });

  it("T029D-P01 archived groups block membership mutations but allow leave and manage read", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t029d-p01o");
    const member = await verifiedUser(app, emailSender, db, "t029d-p01m");
    const outsider = await verifiedUser(app, emailSender, db, "t029d-p01x");

    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Archive Lifecycle", category: "social", privacy: "PRIVATE_APPROVAL" });
    const groupId = created.body.data.groupId as string;

    await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    const requestsBefore = await request(app)
      .get(`/v1/me/groups/${groupId}/join-requests`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    const pendingId = requestsBefore.body.data.requests[0].membershipId as string;

    await request(app)
      .post(`/v1/me/groups/${groupId}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    const join = await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${outsider.accessToken}`);
    expect(join.status).toBe(403);

    const approve = await request(app)
      .post(`/v1/me/groups/${groupId}/join-requests/${pendingId}/approve`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(approve.status).toBe(403);

    const decline = await request(app)
      .post(`/v1/me/groups/${groupId}/join-requests/${pendingId}/decline`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(decline.status).toBe(403);

    const manage = await request(app)
      .get(`/v1/me/groups/${groupId}/manage`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(manage.status).toBe(200);

    const rearchive = await request(app)
      .post(`/v1/me/groups/${groupId}/archive`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(rearchive.status).toBe(403);

    const ownerLeave = await request(app)
      .delete(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(ownerLeave.status).toBe(403);
  });

  it("T029D-P02 role and cross-group authorization cannot escalate or bleed", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t029d-p02o");
    const mod = await verifiedUser(app, emailSender, db, "t029d-p02mod");
    const member = await verifiedUser(app, emailSender, db, "t029d-p02m");

    const g1 = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Auth Group One", category: "sports", privacy: "PUBLIC" });
    const g2 = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Auth Group Two", category: "sports", privacy: "PRIVATE_APPROVAL" });
    const group1 = g1.body.data.groupId as string;
    const group2 = g2.body.data.groupId as string;

    await request(app)
      .post(`/v1/groups/${group1}/join`)
      .set("Authorization", `Bearer ${mod.accessToken}`);
    await request(app)
      .post(`/v1/me/groups/${group1}/members/${mod.userId}/role`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ role: "MODERATOR" });

    await request(app)
      .post(`/v1/groups/${group2}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    const g2req = await request(app)
      .get(`/v1/me/groups/${group2}/join-requests`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    const g2MembershipId = g2req.body.data.requests[0].membershipId as string;

    const modApproveG2 = await request(app)
      .post(`/v1/me/groups/${group2}/join-requests/${g2MembershipId}/approve`)
      .set("Authorization", `Bearer ${mod.accessToken}`);
    expect(modApproveG2.status).toBe(404);

    const modChangeOwnerRole = await request(app)
      .post(`/v1/me/groups/${group1}/members/${owner.userId}/role`)
      .set("Authorization", `Bearer ${mod.accessToken}`)
      .send({ role: "MEMBER" });
    expect(modChangeOwnerRole.status).toBe(404);

    const memberApprove = await request(app)
      .post(`/v1/me/groups/${group1}/join-requests/${g2MembershipId}/approve`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(memberApprove.status).toBe(404);
  });

  it("T029D-P03 removed and left members lose content access; pending inventory updates", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t029d-p03o");
    const member = await verifiedUser(app, emailSender, db, "t029d-p03m");

    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Access Revoke Club", category: "fitness", privacy: "PUBLIC" });
    const groupId = created.body.data.groupId as string;

    await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);

    await request(app)
      .post(`/v1/groups/${groupId}/posts`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ body: "member post" });

    await request(app)
      .post(`/v1/me/groups/${groupId}/members/${member.userId}/remove`)
      .set("Authorization", `Bearer ${owner.accessToken}`);

    const postsAfterRemove = await request(app)
      .get(`/v1/groups/${groupId}/posts`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(postsAfterRemove.status).toBe(404);

    const chatAfterRemove = await request(app)
      .post(`/v1/groups/${groupId}/chat/messages`)
      .set("Authorization", `Bearer ${member.accessToken}`)
      .send({ body: "nope" });
    expect(chatAfterRemove.status).toBe(404);

    const pendingGroup = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Pending Only", category: "hobbies", privacy: "PRIVATE_APPROVAL" });
    const pendingGroupId = pendingGroup.body.data.groupId as string;
    await request(app)
      .post(`/v1/groups/${pendingGroupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);

    const pendingList = await request(app)
      .get("/v1/me/groups?view=pending")
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(pendingList.body.data.groups.some((g: { groupId: string }) => g.groupId === pendingGroupId)).toBe(
      true,
    );

    const requests = await request(app)
      .get(`/v1/me/groups/${pendingGroupId}/join-requests`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    await request(app)
      .post(
        `/v1/me/groups/${pendingGroupId}/join-requests/${requests.body.data.requests[0].membershipId}/decline`,
      )
      .set("Authorization", `Bearer ${owner.accessToken}`);

    const pendingAfterDecline = await request(app)
      .get("/v1/me/groups?view=pending")
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(
      pendingAfterDecline.body.data.groups.some(
        (g: { groupId: string }) => g.groupId === pendingGroupId,
      ),
    ).toBe(false);

    const rejoin = await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(rejoin.body.data.status).toBe("PENDING");

    const joinedAfterRemoved = await request(app)
      .get("/v1/me/groups?view=joined")
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(
      joinedAfterRemoved.body.data.groups.some((g: { groupId: string }) => g.groupId === groupId),
    ).toBe(false);
  });

  it("T029D-P04 idempotent approve and duplicate join requests stay stable", async () => {
    const owner = await verifiedUser(app, emailSender, db, "t029d-p04o");
    const member = await verifiedUser(app, emailSender, db, "t029d-p04m");

    const created = await request(app)
      .post("/v1/me/groups")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ name: "Idempotent Club", category: "social", privacy: "PRIVATE_APPROVAL" });
    const groupId = created.body.data.groupId as string;

    const firstJoin = await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(firstJoin.body.data.status).toBe("PENDING");

    const secondJoin = await request(app)
      .post(`/v1/groups/${groupId}/join`)
      .set("Authorization", `Bearer ${member.accessToken}`);
    expect(secondJoin.body.data.status).toBe("PENDING");

    const requests = await request(app)
      .get(`/v1/me/groups/${groupId}/join-requests`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(requests.body.data.requests).toHaveLength(1);
    const membershipId = requests.body.data.requests[0].membershipId as string;

    const approve1 = await request(app)
      .post(`/v1/me/groups/${groupId}/join-requests/${membershipId}/approve`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(approve1.status).toBe(200);

    const approve2 = await request(app)
      .post(`/v1/me/groups/${groupId}/join-requests/${membershipId}/approve`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(approve2.status).toBe(200);
    expect(approve2.body.data.status).toBe("ACTIVE");

    const active = await db.communityMembership.count({ where: { groupId, status: "ACTIVE" } });
    expect(active).toBe(2);
  });
});
