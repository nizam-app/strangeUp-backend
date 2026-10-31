-- Task 031I-M1 — manual KYC evidence metadata (Cloudinary authenticated assets; migration not applied until owner runbook)

CREATE TYPE "ManualKycEvidenceKind" AS ENUM ('ID_DOCUMENT', 'ID_DOCUMENT_BACK', 'SELFIE');

CREATE TYPE "ManualIdDocumentType" AS ENUM (
  'PASSPORT',
  'NATIONAL_ID',
  'DRIVERS_LICENSE',
  'STATE_ID',
  'OTHER_ONE_SIDED',
  'OTHER_TWO_SIDED'
);

ALTER TYPE "VerificationProvider" ADD VALUE 'MANUAL';

ALTER TABLE "VerificationSession" ADD COLUMN "manualIdDocumentType" "ManualIdDocumentType";
ALTER TABLE "VerificationSession" ADD COLUMN "manualIdDocumentHasRearSide" BOOLEAN;

CREATE TABLE "ManualVerificationEvidence" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "verificationSessionId" UUID NOT NULL,
    "kind" "ManualKycEvidenceKind" NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ManualVerificationEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManualVerificationEvidence_verificationSessionId_kind_key" ON "ManualVerificationEvidence"("verificationSessionId", "kind");
CREATE INDEX "ManualVerificationEvidence_userId_createdAt_idx" ON "ManualVerificationEvidence"("userId", "createdAt");

ALTER TABLE "ManualVerificationEvidence" ADD CONSTRAINT "ManualVerificationEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualVerificationEvidence" ADD CONSTRAINT "ManualVerificationEvidence_verificationSessionId_fkey" FOREIGN KEY ("verificationSessionId") REFERENCES "VerificationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
