-- Task 033D: Persist SUPER_ADMIN activity cancellation audit decisions.
-- NOT APPLIED in this task (no live database writes / migrate execution).
-- Blocker: durable admin cancel audit cannot run on strangeup_test / strangeup_dev /
-- production until the owner applies this migration. The cancel mutation fail-closes
-- if this table is missing. Do not send notifications or refunds from this path.

CREATE TYPE "ActivityModerationAction" AS ENUM ('CANCEL');

CREATE TABLE "ActivityModerationDecision" (
    "id" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" "ActivityModerationAction" NOT NULL,
    "reasonCode" VARCHAR(64) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "previousActivityStatus" "ActivityStatus" NOT NULL,
    "resultingActivityStatus" "ActivityStatus" NOT NULL,
    "confirmedClosedCount" INTEGER NOT NULL,
    "waitlistedClosedCount" INTEGER NOT NULL,
    "pendingClosedCount" INTEGER NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityModerationDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityModerationDecision_idempotencyKey_key"
    ON "ActivityModerationDecision"("idempotencyKey");

CREATE INDEX "ActivityModerationDecision_activityId_createdAt_idx"
    ON "ActivityModerationDecision"("activityId", "createdAt");

CREATE INDEX "ActivityModerationDecision_actorUserId_createdAt_idx"
    ON "ActivityModerationDecision"("actorUserId", "createdAt");

ALTER TABLE "ActivityModerationDecision"
    ADD CONSTRAINT "ActivityModerationDecision_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityModerationDecision"
    ADD CONSTRAINT "ActivityModerationDecision_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
