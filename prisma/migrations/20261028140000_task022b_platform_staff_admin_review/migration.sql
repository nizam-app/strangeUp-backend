-- Task 022B: Platform staff grants + admin review idempotency.

CREATE TYPE "PlatformStaffRole" AS ENUM ('IDENTITY_REVIEWER');

CREATE TABLE "PlatformStaffGrant" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "PlatformStaffRole" NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grantedByUserId" UUID,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "PlatformStaffGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformStaffGrant_userId_role_key" ON "PlatformStaffGrant"("userId", "role");
CREATE INDEX "PlatformStaffGrant_role_revokedAt_idx" ON "PlatformStaffGrant"("role", "revokedAt");

ALTER TABLE "PlatformStaffGrant"
  ADD CONSTRAINT "PlatformStaffGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IdentityAdminReviewDecision" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "IdentityAdminReviewDecision_idempotencyKey_key"
  ON "IdentityAdminReviewDecision"("idempotencyKey");
