-- Task 021: KYC verification sessions, webhook idempotency, consent audit fields, KYC lifecycle columns.

-- AlterEnum
ALTER TYPE "IdentityVerificationStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "IdentityVerificationStatus" ADD VALUE 'REVOKED';

-- CreateEnum
CREATE TYPE "VerificationProvider" AS ENUM ('MOCK', 'VERIFF');
CREATE TYPE "VerificationSessionStatus" AS ENUM (
  'PENDING_USER',
  'PENDING_PROVIDER',
  'APPROVED',
  'DECLINED',
  'RESUBMISSION_REQUESTED',
  'IN_REVIEW',
  'EXPIRED',
  'ABANDONED',
  'CANCELLED'
);

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "identityVerificationApprovedAt" TIMESTAMP(3),
ADD COLUMN "identityVerificationValidUntil" TIMESTAMP(3),
ADD COLUMN "identityVerificationRevokedAt" TIMESTAMP(3);

-- AlterTable ConsentRecord
ALTER TABLE "ConsentRecord" ADD COLUMN "documentId" TEXT,
ADD COLUMN "acceptanceContext" TEXT NOT NULL DEFAULT 'REGISTRATION';

CREATE INDEX "ConsentRecord_userId_consentType_documentVersion_idx" ON "ConsentRecord"("userId", "consentType", "documentVersion");

-- CreateTable VerificationSession
CREATE TABLE "VerificationSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "VerificationProvider" NOT NULL,
    "providerSessionRef" TEXT NOT NULL,
    "providerAttemptRef" TEXT,
    "status" "VerificationSessionStatus" NOT NULL DEFAULT 'PENDING_USER',
    "authoritySequence" BIGINT NOT NULL DEFAULT 0,
    "sessionExpiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable VerificationDecision
CREATE TABLE "VerificationDecision" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "decisionStatus" "VerificationSessionStatus" NOT NULL,
    "decisionAt" TIMESTAMP(3) NOT NULL,
    "authoritySequence" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable VerificationWebhookReceipt
CREATE TABLE "VerificationWebhookReceipt" (
    "id" UUID NOT NULL,
    "provider" "VerificationProvider" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "sessionId" UUID,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationWebhookReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationSession_provider_providerSessionRef_key" ON "VerificationSession"("provider", "providerSessionRef");
CREATE INDEX "VerificationSession_userId_createdAt_idx" ON "VerificationSession"("userId", "createdAt");
CREATE INDEX "VerificationSession_userId_status_idx" ON "VerificationSession"("userId", "status");

CREATE UNIQUE INDEX "VerificationDecision_sessionId_providerEventId_key" ON "VerificationDecision"("sessionId", "providerEventId");
CREATE INDEX "VerificationDecision_sessionId_authoritySequence_idx" ON "VerificationDecision"("sessionId", "authoritySequence");

CREATE UNIQUE INDEX "VerificationWebhookReceipt_provider_providerEventId_key" ON "VerificationWebhookReceipt"("provider", "providerEventId");

-- AddForeignKey
ALTER TABLE "VerificationSession" ADD CONSTRAINT "VerificationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificationDecision" ADD CONSTRAINT "VerificationDecision_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VerificationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
