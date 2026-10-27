-- Task 006: optional profile username with case-insensitive uniqueness (owner-approved).

ALTER TABLE "Profile" ADD COLUMN "username" TEXT;

CREATE UNIQUE INDEX "Profile_username_lower_key" ON "Profile" (LOWER("username")) WHERE "username" IS NOT NULL;
