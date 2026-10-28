-- Task 023C: device tokens + notification preferences (push delivery still off until 023D)

CREATE TYPE "DevicePlatform" AS ENUM ('ANDROID', 'IOS');

CREATE TABLE "UserDeviceToken" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "platform" "DevicePlatform" NOT NULL,
  "tokenSha256" TEXT NOT NULL,
  "registrationToken" TEXT NOT NULL,
  "deviceBindingId" VARCHAR(128) NOT NULL,
  "sessionId" UUID,
  "revokedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserDeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserNotificationPreference" (
  "userId" UUID NOT NULL,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
  "directMessagesEnabled" BOOLEAN NOT NULL DEFAULT true,
  "messageRequestsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "groupMembershipEnabled" BOOLEAN NOT NULL DEFAULT true,
  "groupChatEnabled" BOOLEAN NOT NULL DEFAULT false,
  "activityUpdatesEnabled" BOOLEAN NOT NULL DEFAULT true,
  "marketingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "UserDeviceToken_tokenSha256_key" ON "UserDeviceToken"("tokenSha256");
CREATE UNIQUE INDEX "UserDeviceToken_userId_deviceBindingId_key" ON "UserDeviceToken"("userId", "deviceBindingId");
CREATE INDEX "UserDeviceToken_userId_revokedAt_idx" ON "UserDeviceToken"("userId", "revokedAt");
CREATE INDEX "UserDeviceToken_sessionId_idx" ON "UserDeviceToken"("sessionId");

ALTER TABLE "UserDeviceToken"
  ADD CONSTRAINT "UserDeviceToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserDeviceToken"
  ADD CONSTRAINT "UserDeviceToken_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserNotificationPreference"
  ADD CONSTRAINT "UserNotificationPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
