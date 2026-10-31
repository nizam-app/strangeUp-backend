-- Task 032C: Persist SUPER_ADMIN account suspend/restore audit decisions.
-- NOT APPLIED in this task (no live database writes / migrate execution).

CREATE TYPE "AccountModerationAction" AS ENUM ('SUSPEND', 'RESTORE');

CREATE TABLE "AccountModerationDecision" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" "AccountModerationAction" NOT NULL,
    "reasonCode" VARCHAR(64) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "previousAccountStatus" "AccountStatus" NOT NULL,
    "resultingAccountStatus" "AccountStatus" NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountModerationDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountModerationDecision_idempotencyKey_key"
    ON "AccountModerationDecision"("idempotencyKey");

CREATE INDEX "AccountModerationDecision_userId_createdAt_idx"
    ON "AccountModerationDecision"("userId", "createdAt");

CREATE INDEX "AccountModerationDecision_actorUserId_createdAt_idx"
    ON "AccountModerationDecision"("actorUserId", "createdAt");

ALTER TABLE "AccountModerationDecision"
    ADD CONSTRAINT "AccountModerationDecision_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AccountModerationDecision"
    ADD CONSTRAINT "AccountModerationDecision_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
