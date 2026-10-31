-- Task 031F-1B.2: Race-safe per-reviewer client idempotency reservations for admin identity review mutations.
-- Depends on: 20261030150000_task031f1_internal_review_hold_notes (ordering only; no FK to notes).

CREATE TABLE "IdentityAdminReviewIdempotencyReservation" (
    "id" UUID NOT NULL,
    "reviewerUserId" UUID NOT NULL,
    "clientKeyDigest" VARCHAR(64) NOT NULL,
    "reviewId" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "payloadFingerprint" VARCHAR(64) NOT NULL,
    "scopedDecisionKey" TEXT NOT NULL,
    "decisionId" UUID,
    "responseReviewId" UUID NOT NULL,
    "responseAdminReviewStatus" "StrangeUpAdminReviewStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityAdminReviewIdempotencyReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdentityAdminReviewIdempotencyReservation_reviewerUserId_clientKeyDigest_key"
    ON "IdentityAdminReviewIdempotencyReservation"("reviewerUserId", "clientKeyDigest");

CREATE UNIQUE INDEX "IdentityAdminReviewIdempotencyReservation_scopedDecisionKey_key"
    ON "IdentityAdminReviewIdempotencyReservation"("scopedDecisionKey");

CREATE UNIQUE INDEX "IdentityAdminReviewIdempotencyReservation_decisionId_key"
    ON "IdentityAdminReviewIdempotencyReservation"("decisionId");

CREATE INDEX "IdentityAdminReviewIdempotencyReservation_reviewId_createdAt_idx"
    ON "IdentityAdminReviewIdempotencyReservation"("reviewId", "createdAt");

ALTER TABLE "IdentityAdminReviewIdempotencyReservation"
    ADD CONSTRAINT "IdentityAdminReviewIdempotencyReservation_reviewerUserId_fkey"
    FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IdentityAdminReviewIdempotencyReservation"
    ADD CONSTRAINT "IdentityAdminReviewIdempotencyReservation_decisionId_fkey"
    FOREIGN KEY ("decisionId") REFERENCES "IdentityAdminReviewDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
