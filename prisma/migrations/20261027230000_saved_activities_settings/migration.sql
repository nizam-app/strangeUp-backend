-- Task 015: Saved Activity entities + email-change challenge type

ALTER TYPE "AuthChallengeType" ADD VALUE IF NOT EXISTS 'EMAIL_CHANGE';

CREATE TABLE "SavedActivity" (
    "userId" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedActivity_pkey" PRIMARY KEY ("userId","activityId")
);

CREATE INDEX "SavedActivity_userId_createdAt_activityId_idx" ON "SavedActivity"("userId", "createdAt", "activityId");

ALTER TABLE "SavedActivity" ADD CONSTRAINT "SavedActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedActivity" ADD CONSTRAINT "SavedActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
