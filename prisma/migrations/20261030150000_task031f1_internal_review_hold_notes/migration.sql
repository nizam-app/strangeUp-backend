-- Task 031F-1: Internal review hold (NEEDS_FURTHER_REVIEW) + staff-only internal notes.
-- Owner must apply via approved migration workflow; do not run automatically from agent tasks.

ALTER TYPE "StrangeUpAdminReviewStatus" ADD VALUE IF NOT EXISTS 'NEEDS_FURTHER_REVIEW';

CREATE TABLE "IdentityAdminReviewInternalNote" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "authorUserId" UUID NOT NULL,
  "body" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "redactedAt" TIMESTAMP(3),
  "redactedByUserId" UUID,
  CONSTRAINT "IdentityAdminReviewInternalNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IdentityAdminReviewInternalNote_userId_createdAt_id_idx"
  ON "IdentityAdminReviewInternalNote"("userId", "createdAt" DESC, "id" DESC);

ALTER TABLE "IdentityAdminReviewInternalNote"
  ADD CONSTRAINT "IdentityAdminReviewInternalNote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IdentityAdminReviewInternalNote"
  ADD CONSTRAINT "IdentityAdminReviewInternalNote_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IdentityAdminReviewInternalNote"
  ADD CONSTRAINT "IdentityAdminReviewInternalNote_redactedByUserId_fkey"
  FOREIGN KEY ("redactedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
