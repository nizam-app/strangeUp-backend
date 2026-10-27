-- Task 014: official merchandise catalog, cart, favorites, jobs board

CREATE TYPE "StoreProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "JobListingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');
CREATE TYPE "JobWorkMode" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');
CREATE TYPE "JobEmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'PER_SESSION');
CREATE TYPE "JobPayPeriod" AS ENUM ('HOURLY', 'ANNUAL', 'PER_SESSION');
CREATE TYPE "JobApplicationStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'WITHDRAWN', 'DECLINED', 'ACCEPTED');

CREATE TABLE "StoreCategory" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreProduct" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "status" "StoreProductStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreProductVariant" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "sizeLabel" TEXT,
    "colorLabel" TEXT,
    "priceCents" INTEGER NOT NULL,
    "compareAtPriceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreProductImage" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreProductImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreFavorite" (
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreFavorite_pkey" PRIMARY KEY ("userId","productId")
);

CREATE TABLE "StoreCartItem" (
    "userId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreCartItem_pkey" PRIMARY KEY ("userId","variantId")
);

CREATE TABLE "JobListing" (
    "id" UUID NOT NULL,
    "authorUserId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "companyDisplayName" TEXT NOT NULL,
    "locationCity" TEXT,
    "locationRegion" TEXT,
    "workMode" "JobWorkMode",
    "employmentType" "JobEmploymentType" NOT NULL,
    "payMinCents" INTEGER,
    "payMaxCents" INTEGER,
    "payCurrency" TEXT,
    "payPeriod" "JobPayPeriod",
    "status" "JobListingStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobListing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedJob" (
    "userId" UUID NOT NULL,
    "jobListingId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedJob_pkey" PRIMARY KEY ("userId","jobListingId")
);

CREATE TABLE "JobApplication" (
    "id" UUID NOT NULL,
    "jobListingId" UUID NOT NULL,
    "applicantUserId" UUID NOT NULL,
    "coverMessage" TEXT NOT NULL,
    "applicationConsentVersion" TEXT NOT NULL,
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreCategory_slug_key" ON "StoreCategory"("slug");
CREATE INDEX "StoreCategory_isActive_sortOrder_idx" ON "StoreCategory"("isActive", "sortOrder");

CREATE UNIQUE INDEX "StoreProduct_slug_key" ON "StoreProduct"("slug");
CREATE INDEX "StoreProduct_status_categoryId_createdAt_id_idx" ON "StoreProduct"("status", "categoryId", "createdAt", "id");
CREATE INDEX "StoreProduct_status_createdAt_id_idx" ON "StoreProduct"("status", "createdAt", "id");

CREATE UNIQUE INDEX "StoreProductVariant_sku_key" ON "StoreProductVariant"("sku");
CREATE INDEX "StoreProductVariant_productId_isActive_idx" ON "StoreProductVariant"("productId", "isActive");
CREATE INDEX "StoreProductVariant_productId_sizeLabel_colorLabel_idx" ON "StoreProductVariant"("productId", "sizeLabel", "colorLabel");

CREATE INDEX "StoreProductImage_productId_sortOrder_idx" ON "StoreProductImage"("productId", "sortOrder");

CREATE INDEX "StoreFavorite_userId_createdAt_idx" ON "StoreFavorite"("userId", "createdAt");

CREATE INDEX "StoreCartItem_userId_idx" ON "StoreCartItem"("userId");

CREATE INDEX "JobListing_status_createdAt_id_idx" ON "JobListing"("status", "createdAt", "id");
CREATE INDEX "JobListing_authorUserId_status_idx" ON "JobListing"("authorUserId", "status");
CREATE INDEX "JobListing_status_employmentType_idx" ON "JobListing"("status", "employmentType");

CREATE INDEX "SavedJob_userId_createdAt_idx" ON "SavedJob"("userId", "createdAt");

CREATE UNIQUE INDEX "JobApplication_jobListingId_applicantUserId_key" ON "JobApplication"("jobListingId", "applicantUserId");
CREATE INDEX "JobApplication_applicantUserId_createdAt_id_idx" ON "JobApplication"("applicantUserId", "createdAt", "id");

ALTER TABLE "StoreProduct" ADD CONSTRAINT "StoreProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StoreCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreProductVariant" ADD CONSTRAINT "StoreProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreProductImage" ADD CONSTRAINT "StoreProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreFavorite" ADD CONSTRAINT "StoreFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreFavorite" ADD CONSTRAINT "StoreFavorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreCartItem" ADD CONSTRAINT "StoreCartItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreCartItem" ADD CONSTRAINT "StoreCartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "StoreProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobListing" ADD CONSTRAINT "JobListing_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_jobListingId_fkey" FOREIGN KEY ("jobListingId") REFERENCES "JobListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobListingId_fkey" FOREIGN KEY ("jobListingId") REFERENCES "JobListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Taxonomy only (Figma category labels); no fictitious products or jobs.
INSERT INTO "StoreCategory" ("id", "slug", "label", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'all-gear', 'All Gear', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('a1000000-0000-4000-8000-000000000002', 'cycling', 'Cycling', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('a1000000-0000-4000-8000-000000000003', 'running', 'Running', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
