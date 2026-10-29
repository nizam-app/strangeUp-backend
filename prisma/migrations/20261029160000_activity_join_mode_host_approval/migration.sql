-- Task 027E: Hybrid activity joining (AUTO | HOST_APPROVAL).

CREATE TYPE "ActivityJoinMode" AS ENUM ('AUTO', 'HOST_APPROVAL');

ALTER TABLE "Activity" ADD COLUMN "joinMode" "ActivityJoinMode" NOT NULL DEFAULT 'AUTO';

ALTER TYPE "ActivityParticipationState" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ActivityParticipationState" ADD VALUE IF NOT EXISTS 'DECLINED';

ALTER TABLE "ActivityParticipation" ADD COLUMN "hostApprovedAt" TIMESTAMP(3);

ALTER TABLE "ActivityParticipation" DROP CONSTRAINT IF EXISTS "ActivityParticipation_waitlist_pos_chk";
ALTER TABLE "ActivityParticipation" ADD CONSTRAINT "ActivityParticipation_waitlist_pos_chk" CHECK (
    ("state" = 'WAITLISTED' AND "waitlistPosition" IS NOT NULL) OR
    ("state" <> 'WAITLISTED' AND "waitlistPosition" IS NULL)
);

ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'ACTIVITY_JOIN_REQUEST_RECEIVED';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'ACTIVITY_JOIN_REQUEST_APPROVED';
ALTER TYPE "UserNotificationType" ADD VALUE IF NOT EXISTS 'ACTIVITY_JOIN_REQUEST_DECLINED';
