-- Task 008: own profile extensions (visibility, location text, avatar metadata, favorite activity preferences).
-- Policy semantics pending owner sign-off: docs/decisions/D-OWN-PROFILE-REMAINING-REQUEST-task008.md

CREATE TYPE "ProfileVisibility" AS ENUM ('EVERYONE', 'VERIFIED_USERS_ONLY');
CREATE TYPE "FavoriteActivitySkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');
CREATE TYPE "FavoriteActivityCadence" AS ENUM ('WEEKLY', 'CASUAL');

ALTER TABLE "Profile"
  ADD COLUMN "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'EVERYONE',
  ADD COLUMN "locationCity" TEXT,
  ADD COLUMN "locationRegion" TEXT,
  ADD COLUMN "avatarStorageKey" TEXT,
  ADD COLUMN "avatarContentType" TEXT,
  ADD COLUMN "avatarUpdatedAt" TIMESTAMP(3);

CREATE TABLE "ProfileFavoriteActivity" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "skillLevel" "FavoriteActivitySkillLevel" NOT NULL,
  "cadence" "FavoriteActivityCadence" NOT NULL,
  "scheduleNote" TEXT,
  "placeLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProfileFavoriteActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfileFavoriteActivity_userId_sortOrder_key" ON "ProfileFavoriteActivity"("userId", "sortOrder");
CREATE INDEX "ProfileFavoriteActivity_userId_idx" ON "ProfileFavoriteActivity"("userId");

ALTER TABLE "ProfileFavoriteActivity"
  ADD CONSTRAINT "ProfileFavoriteActivity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
