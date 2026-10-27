-- Task 016: group stories, post photo attachments, polls, content reports

CREATE TYPE "CommunityGroupMediaKind" AS ENUM ('POST_ATTACHMENT', 'STORY');
CREATE TYPE "CommunityGroupMediaLifecycle" AS ENUM ('ACTIVE', 'REMOVED');
CREATE TYPE "CommunityContentReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'INAPPROPRIATE_MEDIA', 'OTHER');
CREATE TYPE "CommunityContentReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');
CREATE TYPE "CommunityContentReportTargetType" AS ENUM ('POST', 'STORY', 'POST_MEDIA');

CREATE TABLE "CommunityGroupMedia" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "kind" "CommunityGroupMediaKind" NOT NULL,
    "lifecycle" "CommunityGroupMediaLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "authorId" UUID NOT NULL,
    "postId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CommunityGroupMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityGroupStory" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "moderation" "CommunityPostModerationState" NOT NULL DEFAULT 'VISIBLE',
    "removedAt" TIMESTAMP(3),
    "removedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityGroupStory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityPoll" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPoll_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityPollOption" (
    "id" UUID NOT NULL,
    "pollId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "CommunityPollOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunityPollVote" (
    "pollId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPollVote_pkey" PRIMARY KEY ("pollId","userId")
);

CREATE TABLE "CommunityContentReport" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "targetType" "CommunityContentReportTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "reason" "CommunityContentReportReason" NOT NULL,
    "detail" TEXT,
    "status" "CommunityContentReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,

    CONSTRAINT "CommunityContentReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityGroupMedia_postId_key" ON "CommunityGroupMedia"("postId");
CREATE INDEX "CommunityGroupMedia_groupId_kind_lifecycle_expiresAt_idx" ON "CommunityGroupMedia"("groupId", "kind", "lifecycle", "expiresAt");

CREATE UNIQUE INDEX "CommunityGroupStory_mediaId_key" ON "CommunityGroupStory"("mediaId");
CREATE INDEX "CommunityGroupStory_groupId_moderation_expiresAt_createdAt_idx" ON "CommunityGroupStory"("groupId", "moderation", "expiresAt", "createdAt");

CREATE UNIQUE INDEX "CommunityPoll_postId_key" ON "CommunityPoll"("postId");
CREATE INDEX "CommunityPoll_groupId_idx" ON "CommunityPoll"("groupId");

CREATE INDEX "CommunityPollOption_pollId_idx" ON "CommunityPollOption"("pollId");
CREATE UNIQUE INDEX "CommunityPollOption_pollId_sortOrder_key" ON "CommunityPollOption"("pollId", "sortOrder");

CREATE INDEX "CommunityPollVote_pollId_optionId_idx" ON "CommunityPollVote"("pollId", "optionId");

CREATE UNIQUE INDEX "CommunityContentReport_reporterId_targetType_targetId_key" ON "CommunityContentReport"("reporterId", "targetType", "targetId");
CREATE INDEX "CommunityContentReport_groupId_status_createdAt_idx" ON "CommunityContentReport"("groupId", "status", "createdAt");

ALTER TABLE "CommunityGroupMedia" ADD CONSTRAINT "CommunityGroupMedia_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityGroupMedia" ADD CONSTRAINT "CommunityGroupMedia_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityGroupMedia" ADD CONSTRAINT "CommunityGroupMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunityGroupStory" ADD CONSTRAINT "CommunityGroupStory_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityGroupStory" ADD CONSTRAINT "CommunityGroupStory_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityGroupStory" ADD CONSTRAINT "CommunityGroupStory_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "CommunityGroupMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityGroupStory" ADD CONSTRAINT "CommunityGroupStory_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunityPoll" ADD CONSTRAINT "CommunityPoll_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityPoll" ADD CONSTRAINT "CommunityPoll_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityPoll" ADD CONSTRAINT "CommunityPoll_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityPollOption" ADD CONSTRAINT "CommunityPollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "CommunityPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunityPollVote" ADD CONSTRAINT "CommunityPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "CommunityPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityPollVote" ADD CONSTRAINT "CommunityPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityPollVote" ADD CONSTRAINT "CommunityPollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "CommunityPollOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CommunityContentReport" ADD CONSTRAINT "CommunityContentReport_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityContentReport" ADD CONSTRAINT "CommunityContentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityContentReport" ADD CONSTRAINT "CommunityContentReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
