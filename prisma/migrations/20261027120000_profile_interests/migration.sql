-- Task 007: catalog interests + per-user selections (owner-approved 10-option catalog).

CREATE TABLE "Interest" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "Interest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Interest_slug_key" ON "Interest"("slug");

CREATE TABLE "UserInterest" (
    "userId" UUID NOT NULL,
    "interestId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInterest_pkey" PRIMARY KEY ("userId","interestId")
);

CREATE INDEX "UserInterest_interestId_idx" ON "UserInterest"("interestId");

ALTER TABLE "UserInterest" ADD CONSTRAINT "UserInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserInterest" ADD CONSTRAINT "UserInterest_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Interest" ("id", "slug", "label", "sortOrder") VALUES
    ('a1000001-0000-4000-8000-000000000001', 'biking', 'Biking', 1),
    ('a1000001-0000-4000-8000-000000000002', 'fitness', 'Fitness', 2),
    ('a1000001-0000-4000-8000-000000000003', 'outdoor', 'Outdoor', 3),
    ('a1000001-0000-4000-8000-000000000004', 'social', 'Social', 4),
    ('a1000001-0000-4000-8000-000000000005', 'sports', 'Sports', 5),
    ('a1000001-0000-4000-8000-000000000006', 'swimming', 'Swimming', 6),
    ('a1000001-0000-4000-8000-000000000007', 'hiking', 'Hiking', 7),
    ('a1000001-0000-4000-8000-000000000008', 'travel', 'Travel', 8),
    ('a1000001-0000-4000-8000-000000000009', 'music', 'Music', 9),
    ('a1000001-0000-4000-8000-000000000010', 'food', 'Food', 10)
ON CONFLICT ("slug") DO NOTHING;
