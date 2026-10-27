-- Task 008A (OWN-PROFILE-02): new Profile rows default to VERIFIED_USERS_ONLY.
-- Existing rows keep their stored value (migration 20261027140000 set NOT NULL DEFAULT 'EVERYONE').

ALTER TABLE "Profile" ALTER COLUMN "profileVisibility" SET DEFAULT 'VERIFIED_USERS_ONLY';
