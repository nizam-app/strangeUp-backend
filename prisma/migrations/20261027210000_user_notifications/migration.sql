-- Task 013: in-app notification inbox (additive)

CREATE TYPE "UserNotificationType" AS ENUM (
  'MESSAGE_REQUEST_RECEIVED',
  'MESSAGE_REQUEST_ACCEPTED',
  'DIRECT_MESSAGE_RECEIVED',
  'GROUP_MEMBERSHIP_APPROVED',
  'GROUP_MEMBERSHIP_DECLINED',
  'ACTIVITY_RSVP_CONFIRMED',
  'ACTIVITY_RSVP_WAITLISTED',
  'ACTIVITY_WAITLIST_PROMOTED'
);

CREATE TABLE "UserNotification" (
  "id" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "type" "UserNotificationType" NOT NULL,
  "actorUserId" UUID,
  "sourceId" UUID,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "dedupeKey" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserNotification_dedupeKey_key" ON "UserNotification"("dedupeKey");

CREATE INDEX "UserNotification_recipientId_readAt_createdAt_id_idx" ON "UserNotification"("recipientId", "readAt", "createdAt", "id");

CREATE INDEX "UserNotification_recipientId_createdAt_id_idx" ON "UserNotification"("recipientId", "createdAt", "id");

ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
