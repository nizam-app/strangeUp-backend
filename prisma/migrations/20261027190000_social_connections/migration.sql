-- Task 011: Follow graph, waves, DM requests, and 1:1 text conversations.

CREATE TYPE "DirectMessageRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

CREATE TABLE "UserFollow" (
    "followerId" UUID NOT NULL,
    "followingId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("followerId","followingId"),
    CONSTRAINT "UserFollow_no_self_chk" CHECK ("followerId" <> "followingId")
);

CREATE INDEX "UserFollow_followingId_createdAt_idx" ON "UserFollow"("followingId", "createdAt");

ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserWave" (
    "id" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWave_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserWave_no_self_chk" CHECK ("senderId" <> "recipientId")
);

CREATE UNIQUE INDEX "UserWave_senderId_recipientId_key" ON "UserWave"("senderId", "recipientId");
CREATE INDEX "UserWave_recipientId_createdAt_idx" ON "UserWave"("recipientId", "createdAt");

ALTER TABLE "UserWave" ADD CONSTRAINT "UserWave_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserWave" ADD CONSTRAINT "UserWave_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DirectConversation" (
    "id" UUID NOT NULL,
    "participantLowId" UUID NOT NULL,
    "participantHighId" UUID NOT NULL,
    "lastMessageId" UUID,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectConversation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DirectConversation_pair_chk" CHECK ("participantLowId" < "participantHighId")
);

CREATE UNIQUE INDEX "DirectConversation_participantLowId_participantHighId_key" ON "DirectConversation"("participantLowId", "participantHighId");
CREATE INDEX "DirectConversation_updatedAt_id_idx" ON "DirectConversation"("updatedAt", "id");

ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_participantLowId_fkey" FOREIGN KEY ("participantLowId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_participantHighId_fkey" FOREIGN KEY ("participantHighId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DirectMessageRequest" (
    "id" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "status" "DirectMessageRequestStatus" NOT NULL DEFAULT 'PENDING',
    "conversationId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "DirectMessageRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DirectMessageRequest_no_self_chk" CHECK ("senderId" <> "recipientId")
);

CREATE UNIQUE INDEX "DirectMessageRequest_senderId_recipientId_key" ON "DirectMessageRequest"("senderId", "recipientId");
CREATE INDEX "DirectMessageRequest_recipientId_status_createdAt_idx" ON "DirectMessageRequest"("recipientId", "status", "createdAt");
CREATE INDEX "DirectMessageRequest_senderId_status_createdAt_idx" ON "DirectMessageRequest"("senderId", "status", "createdAt");

ALTER TABLE "DirectMessageRequest" ADD CONSTRAINT "DirectMessageRequest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectMessageRequest" ADD CONSTRAINT "DirectMessageRequest_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectMessageRequest" ADD CONSTRAINT "DirectMessageRequest_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DirectConversationParticipant" (
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lastReadMessageId" UUID,
    "lastReadAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectConversationParticipant_pkey" PRIMARY KEY ("conversationId","userId")
);

CREATE INDEX "DirectConversationParticipant_userId_idx" ON "DirectConversationParticipant"("userId");

ALTER TABLE "DirectConversationParticipant" ADD CONSTRAINT "DirectConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectConversationParticipant" ADD CONSTRAINT "DirectConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DirectMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "clientMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DirectMessage_conversationId_authorId_clientMessageId_key" ON "DirectMessage"("conversationId", "authorId", "clientMessageId");
CREATE INDEX "DirectMessage_conversationId_createdAt_id_idx" ON "DirectMessage"("conversationId", "createdAt", "id");

ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
