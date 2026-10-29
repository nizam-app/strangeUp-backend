-- Task 028C: Personal 1:1 meetup invitation foundation (D-28 accepted scope).

CREATE TYPE "PersonalMeetupInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');

CREATE TYPE "PersonalMeetupInviteType" AS ENUM ('COFFEE', 'ACTIVITY', 'SPORTS', 'OTHER');

CREATE TABLE "PersonalMeetupInvitation" (
    "id" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "status" "PersonalMeetupInviteStatus" NOT NULL,
    "meetupType" "PersonalMeetupInviteType" NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledStartsAt" TIMESTAMP(3) NOT NULL,
    "scheduleTimeZone" TEXT NOT NULL,
    "venueCity" TEXT NOT NULL,
    "venueRegion" TEXT NOT NULL,
    "venueLabel" TEXT,
    "venueAddressLine" TEXT,
    "venuePlaceNotes" TEXT,
    "note" TEXT,
    "createIdempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),

    CONSTRAINT "PersonalMeetupInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PersonalMeetupInvitation_createIdempotencyKey_key" ON "PersonalMeetupInvitation"("createIdempotencyKey");

CREATE INDEX "PersonalMeetupInvitation_recipientId_status_createdAt_id_idx" ON "PersonalMeetupInvitation"("recipientId", "status", "createdAt", "id");

CREATE INDEX "PersonalMeetupInvitation_senderId_status_createdAt_id_idx" ON "PersonalMeetupInvitation"("senderId", "status", "createdAt", "id");

CREATE INDEX "PersonalMeetupInvitation_scheduledStartsAt_idx" ON "PersonalMeetupInvitation"("scheduledStartsAt");

CREATE UNIQUE INDEX "PersonalMeetupInvitation_one_pending_per_ordered_pair_idx" ON "PersonalMeetupInvitation"("senderId", "recipientId") WHERE "status" = 'PENDING';

ALTER TABLE "PersonalMeetupInvitation" ADD CONSTRAINT "PersonalMeetupInvitation_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PersonalMeetupInvitation" ADD CONSTRAINT "PersonalMeetupInvitation_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
