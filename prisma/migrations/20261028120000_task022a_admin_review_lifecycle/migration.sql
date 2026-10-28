-- Task 022A: StrangeUp admin review lifecycle (orthogonal to provider identity status).

CREATE TYPE "StrangeUpAdminReviewStatus" AS ENUM (
  'NOT_READY',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'NEEDS_MORE_INFO'
);

ALTER TABLE "User"
  ADD COLUMN "identityVerificationSessionId" UUID,
  ADD COLUMN "adminReviewStatus" "StrangeUpAdminReviewStatus" NOT NULL DEFAULT 'NOT_READY',
  ADD COLUMN "adminReviewVerificationSessionId" UUID,
  ADD COLUMN "adminReviewDecidedAt" TIMESTAMP(3);

CREATE TABLE "IdentityAdminReviewDecision" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "verificationSessionId" UUID NOT NULL,
  "status" "StrangeUpAdminReviewStatus" NOT NULL,
  "reasonCode" TEXT,
  "reviewerUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentityAdminReviewDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IdentityAdminReviewDecision_userId_createdAt_idx"
  ON "IdentityAdminReviewDecision"("userId", "createdAt");
CREATE INDEX "IdentityAdminReviewDecision_verificationSessionId_createdAt_idx"
  ON "IdentityAdminReviewDecision"("verificationSessionId", "createdAt");
CREATE INDEX "User_adminReviewStatus_idx" ON "User"("adminReviewStatus");

ALTER TABLE "User"
  ADD CONSTRAINT "User_identityVerificationSessionId_fkey"
  FOREIGN KEY ("identityVerificationSessionId") REFERENCES "VerificationSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User"
  ADD CONSTRAINT "User_adminReviewVerificationSessionId_fkey"
  FOREIGN KEY ("adminReviewVerificationSessionId") REFERENCES "VerificationSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IdentityAdminReviewDecision"
  ADD CONSTRAINT "IdentityAdminReviewDecision_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IdentityAdminReviewDecision"
  ADD CONSTRAINT "IdentityAdminReviewDecision_verificationSessionId_fkey"
  FOREIGN KEY ("verificationSessionId") REFERENCES "VerificationSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
