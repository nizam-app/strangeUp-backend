-- Task 012: Groups & Communities. Additive only; does not rewrite prior migrations.

CREATE TYPE "CommunityGroupPrivacy" AS ENUM ('PUBLIC', 'PRIVATE_APPROVAL');
CREATE TYPE "CommunityGroupStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "CommunityGroupMeetupFrequency" AS ENUM ('WEEKLY', 'ACTIVE_DAILY', 'BIWEEKLY');
CREATE TYPE "CommunityMembershipRole" AS ENUM ('OWNER', 'MODERATOR', 'MEMBER');
CREATE TYPE "CommunityMembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'DECLINED', 'REMOVED', 'LEFT');
CREATE TYPE "CommunityPostModerationState" AS ENUM ('VISIBLE', 'REMOVED');

CREATE TABLE "CommunityGroupCategory" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "CommunityGroupCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityGroupCategory_slug_key" ON "CommunityGroupCategory"("slug");

CREATE TABLE "CommunityGroup" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" UUID NOT NULL,
    "locationCity" TEXT,
    "locationRegion" TEXT,
    "privacy" "CommunityGroupPrivacy" NOT NULL,
    "meetupFrequency" "CommunityGroupMeetupFrequency",
    "memberCapacity" INTEGER,
    "status" "CommunityGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "coverStorageKey" TEXT,
    "coverContentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityGroup_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommunityGroup_name_len_chk" CHECK (char_length("name") >= 1 AND char_length("name") <= 60),
    CONSTRAINT "CommunityGroup_capacity_chk" CHECK ("memberCapacity" IS NULL OR "memberCapacity" >= 2)
);

CREATE INDEX "CommunityGroup_status_privacy_createdAt_idx" ON "CommunityGroup"("status", "privacy", "createdAt");
CREATE INDEX "CommunityGroup_categoryId_status_idx" ON "CommunityGroup"("categoryId", "status");
CREATE INDEX "CommunityGroup_locationCity_locationRegion_idx" ON "CommunityGroup"("locationCity", "locationRegion");
CREATE INDEX "CommunityGroup_ownerId_status_idx" ON "CommunityGroup"("ownerId", "status");

ALTER TABLE "CommunityGroup" ADD CONSTRAINT "CommunityGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunityGroup" ADD CONSTRAINT "CommunityGroup_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CommunityGroupCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CommunityGroupTag" (
    "groupId" UUID NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "CommunityGroupTag_pkey" PRIMARY KEY ("groupId", "tag"),
    CONSTRAINT "CommunityGroupTag_tag_len_chk" CHECK (char_length("tag") >= 2 AND char_length("tag") <= 24)
);

CREATE INDEX "CommunityGroupTag_tag_idx" ON "CommunityGroupTag"("tag");

ALTER TABLE "CommunityGroupTag" ADD CONSTRAINT "CommunityGroupTag_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommunityMembership" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "CommunityMembershipRole" NOT NULL,
    "status" "CommunityMembershipStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "approverId" UUID,

    CONSTRAINT "CommunityMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityMembership_groupId_userId_key" ON "CommunityMembership"("groupId", "userId");
CREATE INDEX "CommunityMembership_groupId_status_idx" ON "CommunityMembership"("groupId", "status");
CREATE INDEX "CommunityMembership_userId_status_idx" ON "CommunityMembership"("userId", "status");

ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CommunityPost" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "activityId" UUID,
    "pinnedAt" TIMESTAMP(3),
    "pinnedById" UUID,
    "moderation" "CommunityPostModerationState" NOT NULL DEFAULT 'VISIBLE',
    "removedAt" TIMESTAMP(3),
    "removedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommunityPost_pin_chk" CHECK (
        ("pinnedAt" IS NULL AND "pinnedById" IS NULL) OR
        ("pinnedAt" IS NOT NULL AND "pinnedById" IS NOT NULL)
    )
);

CREATE INDEX "CommunityPost_groupId_moderation_pinnedAt_createdAt_idx" ON "CommunityPost"("groupId", "moderation", "pinnedAt", "createdAt");
CREATE INDEX "CommunityPost_authorId_createdAt_idx" ON "CommunityPost"("authorId", "createdAt");

ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CommunityPostComment" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "removedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPostComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunityPostComment_postId_createdAt_idx" ON "CommunityPostComment"("postId", "createdAt");

ALTER TABLE "CommunityPostComment" ADD CONSTRAINT "CommunityPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityPostComment" ADD CONSTRAINT "CommunityPostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityPostComment" ADD CONSTRAINT "CommunityPostComment_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CommunityPostLike" (
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPostLike_pkey" PRIMARY KEY ("postId", "userId")
);

ALTER TABLE "CommunityPostLike" ADD CONSTRAINT "CommunityPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityPostLike" ADD CONSTRAINT "CommunityPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommunityGroupMessage" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "clientMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityGroupMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityGroupMessage_groupId_authorId_clientMessageId_key" ON "CommunityGroupMessage"("groupId", "authorId", "clientMessageId");
CREATE INDEX "CommunityGroupMessage_groupId_createdAt_id_idx" ON "CommunityGroupMessage"("groupId", "createdAt", "id");

ALTER TABLE "CommunityGroupMessage" ADD CONSTRAINT "CommunityGroupMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityGroupMessage" ADD CONSTRAINT "CommunityGroupMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommunityGroupReadState" (
    "groupId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lastReadMessageId" UUID,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "CommunityGroupReadState_pkey" PRIMARY KEY ("groupId", "userId")
);

CREATE INDEX "CommunityGroupReadState_userId_idx" ON "CommunityGroupReadState"("userId");

ALTER TABLE "CommunityGroupReadState" ADD CONSTRAINT "CommunityGroupReadState_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityGroupReadState" ADD CONSTRAINT "CommunityGroupReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommunityGroupActivity" (
    "groupId" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "attachedById" UUID NOT NULL,
    "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityGroupActivity_pkey" PRIMARY KEY ("groupId", "activityId")
);

CREATE INDEX "CommunityGroupActivity_activityId_idx" ON "CommunityGroupActivity"("activityId");

ALTER TABLE "CommunityGroupActivity" ADD CONSTRAINT "CommunityGroupActivity_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityGroupActivity" ADD CONSTRAINT "CommunityGroupActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityGroupActivity" ADD CONSTRAINT "CommunityGroupActivity_attachedById_fkey" FOREIGN KEY ("attachedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "CommunityGroupCategory" ("id", "slug", "label", "sortOrder") VALUES
    ('c1000001-0000-4000-8000-000000000001', 'sports', 'Sports', 1),
    ('c1000001-0000-4000-8000-000000000002', 'fitness', 'Fitness', 2),
    ('c1000001-0000-4000-8000-000000000003', 'outdoor', 'Outdoor', 3),
    ('c1000001-0000-4000-8000-000000000004', 'social', 'Social', 4),
    ('c1000001-0000-4000-8000-000000000005', 'hobbies', 'Hobbies', 5)
ON CONFLICT ("slug") DO NOTHING;
