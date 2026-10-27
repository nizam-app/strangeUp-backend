-- Task 010: Activities & Meetups (Screens 11–13).

CREATE TYPE "ActivityMode" AS ENUM ('IN_PERSON', 'VIRTUAL', 'HYBRID');
CREATE TYPE "ActivityStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "ActivityAudience" AS ENUM ('PUBLIC', 'FOLLOWERS_ONLY');
CREATE TYPE "ActivityParticipationState" AS ENUM ('CONFIRMED', 'WAITLISTED', 'CANCELLED');

CREATE TABLE "ActivityCategory" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ActivityCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityCategory_slug_key" ON "ActivityCategory"("slug");

CREATE TABLE "Activity" (
    "id" UUID NOT NULL,
    "hostId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" UUID NOT NULL,
    "coverStorageKey" TEXT,
    "coverContentType" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "mode" "ActivityMode" NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'DRAFT',
    "audience" "ActivityAudience" NOT NULL DEFAULT 'PUBLIC',
    "venueName" TEXT,
    "locationCity" TEXT,
    "locationRegion" TEXT,
    "meetingInstructions" TEXT,
    "virtualMeetingDetails" TEXT,
    "skillNotes" TEXT,
    "gearNotes" TEXT,
    "capacity" INTEGER NOT NULL,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Activity_capacity_chk" CHECK ("capacity" > 0),
    CONSTRAINT "Activity_time_range_chk" CHECK ("endsAt" > "startsAt")
);

CREATE INDEX "Activity_status_audience_startsAt_idx" ON "Activity"("status", "audience", "startsAt");
CREATE INDEX "Activity_categoryId_status_startsAt_idx" ON "Activity"("categoryId", "status", "startsAt");
CREATE INDEX "Activity_hostId_status_idx" ON "Activity"("hostId", "status");
CREATE INDEX "Activity_locationCity_locationRegion_idx" ON "Activity"("locationCity", "locationRegion");

ALTER TABLE "Activity" ADD CONSTRAINT "Activity_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ActivityCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ActivityParticipation" (
    "id" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "state" "ActivityParticipationState" NOT NULL,
    "waitlistPosition" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityParticipation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActivityParticipation_waitlist_pos_chk" CHECK (
        ("state" = 'WAITLISTED' AND "waitlistPosition" IS NOT NULL) OR
        ("state" <> 'WAITLISTED' AND "waitlistPosition" IS NULL)
    )
);

CREATE UNIQUE INDEX "ActivityParticipation_activityId_userId_key" ON "ActivityParticipation"("activityId", "userId");
CREATE INDEX "ActivityParticipation_userId_state_idx" ON "ActivityParticipation"("userId", "state");
CREATE INDEX "ActivityParticipation_activityId_state_waitlistPosition_idx" ON "ActivityParticipation"("activityId", "state", "waitlistPosition");

ALTER TABLE "ActivityParticipation" ADD CONSTRAINT "ActivityParticipation_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityParticipation" ADD CONSTRAINT "ActivityParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ActivityCategory" ("id", "slug", "label", "sortOrder") VALUES
    ('b1000001-0000-4000-8000-000000000001', 'biking', 'Biking', 1),
    ('b1000001-0000-4000-8000-000000000002', 'padel-tennis', 'Padel & Tennis', 2),
    ('b1000001-0000-4000-8000-000000000003', 'running', 'Running', 3),
    ('b1000001-0000-4000-8000-000000000004', 'swimming', 'Swimming', 4),
    ('b1000001-0000-4000-8000-000000000005', 'fitness', 'Fitness', 5)
ON CONFLICT ("slug") DO NOTHING;
