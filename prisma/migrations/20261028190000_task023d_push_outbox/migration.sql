-- Task 023D: durable push notification outbox

CREATE TYPE "PushOutboxStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'SENT',
  'SKIPPED',
  'FAILED'
);

CREATE TABLE "PushNotificationOutbox" (
  "id" UUID NOT NULL,
  "userNotificationId" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "status" "PushOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PushNotificationOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushNotificationOutbox_userNotificationId_key" ON "PushNotificationOutbox"("userNotificationId");
CREATE INDEX "PushNotificationOutbox_status_nextAttemptAt_idx" ON "PushNotificationOutbox"("status", "nextAttemptAt");
CREATE INDEX "PushNotificationOutbox_recipientId_idx" ON "PushNotificationOutbox"("recipientId");

ALTER TABLE "PushNotificationOutbox"
  ADD CONSTRAINT "PushNotificationOutbox_userNotificationId_fkey"
  FOREIGN KEY ("userNotificationId") REFERENCES "UserNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushNotificationOutbox"
  ADD CONSTRAINT "PushNotificationOutbox_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
