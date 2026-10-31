/**
 * Task 031F-1 / 031F-1B / 031F-1B.2 integration tests — require migrations applied to INTEGRATION_DATABASE_URL:
 * - `20261030150000_task031f1_internal_review_hold_notes`
 * - `20261030160000_task031f1b2_admin_review_idempotency_reservation`
 *
 * Enable: replace describe.skip with describe when RUN_INTEGRATION=1 and schema is migrated.
 * DO NOT RUN against unmigrated schema.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import pino from "pino";
import { createApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import {
  createPrismaClient,
  disconnectPrisma,
  type DatabaseClient,
} from "../../src/infrastructure/database/prisma.js";
import { createCapturingEmailSender } from "../helpers/capturing-email-sender.js";
import { clearRateLimits } from "../../src/modules/auth/rate-limit.js";
import {
  grantIdentityReviewer,
  mockApproveWebhookBody,
  seedProviderApprovedApplicant,
  signMockWebhook,
  KYC_TEST_WEBHOOK_SECRET,
} from "../helpers/kyc-applicant.js";

const defaultConsents = [
  { type: "TERMS", version: "pending-legal-review" },
  { type: "PRIVACY", version: "pending-legal-review" },
  { type: "AGE_ATTESTATION", version: "pending-legal-review" },
];

async function registerAndLogin(
  app: ReturnType<typeof createApp>,
  prefix: string,
): Promise<{ userId: string; accessToken: string }> {
  const email = `${prefix}-${Date.now()}@example.com`;
  await request(app).post("/v1/auth/register").send({
    firstName: "Admin",
    lastName: "Test",
    email,
    password: "ValidPass1",
    dateOfBirth: "1995-06-15",
    consents: defaultConsents,
  });
  const login = await request(app).post("/v1/auth/login").send({ email, password: "ValidPass1" });
  expect(login.status).toBe(200);
  return {
    userId: login.body.data.user.id as string,
    accessToken: login.body.data.accessToken as string,
  };
}

describe.skip("integration: admin identity review 031F-1 (migration pending)", () => {
  let app: ReturnType<typeof createApp>;
  let db: DatabaseClient;

  beforeAll(() => {
    const url = process.env.INTEGRATION_DATABASE_URL?.trim();
    if (!url) {
      throw new Error("INTEGRATION_DATABASE_URL required when enabling 031F-1 integration tests");
    }
    db = createPrismaClient(url);
    const env = loadEnv({
      NODE_ENV: "test",
      DATABASE_URL: url,
      CORS_ORIGINS: "http://localhost:3000",
      JWT_ACCESS_SECRET: "test-jwt-access-secret-min-32-chars!!",
      KYC_PROVIDER_ENABLED: "true",
      KYC_PROVIDER: "mock",
      KYC_MOCK_WEBHOOK_HMAC_SECRET: KYC_TEST_WEBHOOK_SECRET,
      CONSENT_ENFORCEMENT: "placeholder_allowed",
    });
    app = createApp({
      env,
      db,
      logger: pino({ level: "silent" }),
      emailSender: createCapturingEmailSender(),
    });
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeEach(async () => {
    clearRateLimits();
    await db.$executeRawUnsafe(`
      TRUNCATE TABLE
        "IdentityAdminReviewIdempotencyReservation",
        "IdentityAdminReviewInternalNote",
        "IdentityAdminReviewDecision",
        "PlatformStaffGrant",
        "VerificationDecision",
        "VerificationWebhookReceipt",
        "VerificationSession",
        "ConsentRecord",
        "RegisterIdempotency",
        "AuthChallenge",
        "Session",
        "PasswordCredential",
        "Profile",
        "User"
      RESTART IDENTITY CASCADE
    `);
  });

  it("denies unauthenticated admin routes", async () => {
    const res = await request(app).get("/v1/admin/identity-reviews/summary");
    expect(res.status).toBe(401);
  });

  it("denies non-reviewer authenticated users", async () => {
    const user = await registerAndLogin(app, "ordinary-user-031f1");
    const res = await request(app)
      .get("/v1/admin/identity-reviews/summary")
      .set("Authorization", `Bearer ${user.accessToken}`);
    expect(res.status).toBe(403);
  });

  it("denies self-review on hold", async () => {
    const reviewer = await registerAndLogin(app, "self-hold-031f1");
    await grantIdentityReviewer(db, reviewer.userId);
    await seedProviderApprovedApplicant(
      db,
      reviewer.userId,
      randomUUID(),
      `ref-self-hold-${Date.now()}`,
    );

    const hold = await request(app)
      .post(`/v1/admin/identity-reviews/${reviewer.userId}/needs-further-review`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .send({});
    expect(hold.status).toBe(403);
  });

  it("places review on internal hold and returns to pending", async () => {
    const reviewer = await registerAndLogin(app, "rev-hold-031f1");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant-hold-031f1");
    await seedProviderApprovedApplicant(
      db,
      applicant.userId,
      randomUUID(),
      `ref-hold-${Date.now()}`,
    );

    const hold = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/needs-further-review`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .send({ optionalNote: "Needs senior review." });
    expect(hold.status).toBe(200);
    expect(hold.body.data.adminReviewStatus).toBe("NEEDS_FURTHER_REVIEW");

    const back = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/return-to-pending`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .send({});
    expect(back.status).toBe(200);
    expect(back.body.data.adminReviewStatus).toBe("PENDING");
  });

  it("rejects approve while on hold", async () => {
    const reviewer = await registerAndLogin(app, "rev-hold-approve");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant-hold-approve");
    await seedProviderApprovedApplicant(
      db,
      applicant.userId,
      randomUUID(),
      `ref-hold-approve-${Date.now()}`,
    );

    await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/needs-further-review`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .send({});

    const approve = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(approve.status).toBe(409);
  });

  it("rejects internal notes after terminal approve", async () => {
    const reviewer = await registerAndLogin(app, "rev-terminal-note");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant-terminal-note");
    await seedProviderApprovedApplicant(
      db,
      applicant.userId,
      randomUUID(),
      `ref-terminal-${Date.now()}`,
    );

    await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`);

    const note = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/notes`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .send({ body: "Too late." });
    expect(note.status).toBe(409);
  });

  it("rejects hold when provider session no longer matches queue binding", async () => {
    const reviewer = await registerAndLogin(app, "rev-stale-session");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant-stale-session");
    const sessionId = randomUUID();
    await seedProviderApprovedApplicant(db, applicant.userId, sessionId, `ref-stale-${Date.now()}`);

    const newSessionId = randomUUID();
    await db.verificationSession.create({
      data: {
        id: newSessionId,
        userId: applicant.userId,
        provider: "MOCK",
        providerSessionRef: `ref-new-${Date.now()}`,
        status: "APPROVED",
        sessionExpiresAt: new Date(Date.now() + 3_600_000),
        completedAt: new Date(),
      },
    });
    await db.user.update({
      where: { id: applicant.userId },
      data: { identityVerificationSessionId: newSessionId },
    });

    const hold = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/needs-further-review`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .send({});
    expect(hold.status).toBe(409);
  });

  it("idempotent hold replay with identical key and payload", async () => {
    const reviewer = await registerAndLogin(app, "rev-hold-idem");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant-hold-idem");
    await seedProviderApprovedApplicant(
      db,
      applicant.userId,
      randomUUID(),
      `ref-hold-idem-${Date.now()}`,
    );
    const key = `hold-${randomUUID()}`;

    const first = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/needs-further-review`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .set("Idempotency-Key", key)
      .send({ optionalNote: "Escalate." });
    const second = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/needs-further-review`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .set("Idempotency-Key", key)
      .send({ optionalNote: "Escalate." });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.idempotentReplay).toBe(true);

    const decisions = await db.identityAdminReviewDecision.count({
      where: { userId: applicant.userId, status: "NEEDS_FURTHER_REVIEW" },
    });
    expect(decisions).toBe(1);
    const notes = await db.identityAdminReviewInternalNote.count({
      where: { userId: applicant.userId },
    });
    expect(notes).toBe(1);
  });

  it("409 when idempotency key is reused on a different review", async () => {
    const reviewer = await registerAndLogin(app, "rev-cross-review");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicantA = await registerAndLogin(app, "applicant-cross-a");
    const applicantB = await registerAndLogin(app, "applicant-cross-b");
    await seedProviderApprovedApplicant(
      db,
      applicantA.userId,
      randomUUID(),
      `ref-cross-a-${Date.now()}`,
    );
    await seedProviderApprovedApplicant(
      db,
      applicantB.userId,
      randomUUID(),
      `ref-cross-b-${Date.now()}`,
    );
    const key = `shared-${randomUUID()}`;

    const first = await request(app)
      .post(`/v1/admin/identity-reviews/${applicantA.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .set("Idempotency-Key", key);
    expect(first.status).toBe(200);

    const cross = await request(app)
      .post(`/v1/admin/identity-reviews/${applicantB.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .set("Idempotency-Key", key);
    expect(cross.status).toBe(409);
    expect(cross.body.error.message).toBe("Idempotency key reused with different payload");

    const userB = await db.user.findUniqueOrThrow({ where: { id: applicantB.userId } });
    expect(userB.adminReviewStatus).toBe("PENDING");
  });

  it("409 when idempotency key is reused with a different action", async () => {
    const reviewer = await registerAndLogin(app, "rev-cross-action");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant-cross-action");
    await seedProviderApprovedApplicant(
      db,
      applicant.userId,
      randomUUID(),
      `ref-cross-action-${Date.now()}`,
    );
    const key = `action-${randomUUID()}`;

    await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .set("Idempotency-Key", key);

    const reject = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/reject`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .set("Idempotency-Key", key)
      .send({ reasonCode: "POLICY_INELIGIBLE" });
    expect(reject.status).toBe(409);
  });

  it("409 when reject idempotency key is reused with a different reasonCode", async () => {
    const reviewer = await registerAndLogin(app, "rev-reason-idem");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant-reason-idem");
    await seedProviderApprovedApplicant(
      db,
      applicant.userId,
      randomUUID(),
      `ref-reason-${Date.now()}`,
    );
    const key = `reject-${randomUUID()}`;

    await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/reject`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .set("Idempotency-Key", key)
      .send({ reasonCode: "POLICY_INELIGIBLE" });

    const mismatch = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/reject`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .set("Idempotency-Key", key)
      .send({ reasonCode: "FRAUD_SUSPECTED" });
    expect(mismatch.status).toBe(409);
  });

  it("409 when hold idempotency key is reused with a different optionalNote", async () => {
    const reviewer = await registerAndLogin(app, "rev-note-idem");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant-note-idem");
    await seedProviderApprovedApplicant(
      db,
      applicant.userId,
      randomUUID(),
      `ref-note-idem-${Date.now()}`,
    );
    const key = `note-${randomUUID()}`;

    await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/needs-further-review`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .set("Idempotency-Key", key)
      .send({ optionalNote: "First note." });

    const mismatch = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/needs-further-review`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .set("Idempotency-Key", key)
      .send({ optionalNote: "Second note." });
    expect(mismatch.status).toBe(409);
  });

  it("serial concurrent hold requests yield one decision", async () => {
    const reviewer = await registerAndLogin(app, "rev-concurrent-hold");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant-concurrent-hold");
    await seedProviderApprovedApplicant(
      db,
      applicant.userId,
      randomUUID(),
      `ref-concurrent-${Date.now()}`,
    );

    const [a, b] = await Promise.all([
      request(app)
        .post(`/v1/admin/identity-reviews/${applicant.userId}/needs-further-review`)
        .set("Authorization", `Bearer ${reviewer.accessToken}`)
        .send({}),
      request(app)
        .post(`/v1/admin/identity-reviews/${applicant.userId}/needs-further-review`)
        .set("Authorization", `Bearer ${reviewer.accessToken}`)
        .send({}),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const decisions = await db.identityAdminReviewDecision.count({
      where: { userId: applicant.userId, status: "NEEDS_FURTHER_REVIEW" },
    });
    expect(decisions).toBe(1);
  });

  it("filters pending queue by posture and keeps summary totals aligned", async () => {
    const reviewer = await registerAndLogin(app, "rev-posture-031f1");
    await grantIdentityReviewer(db, reviewer.userId);
    const onHold = await registerAndLogin(app, "applicant-on-hold-posture");
    await seedProviderApprovedApplicant(
      db,
      onHold.userId,
      randomUUID(),
      `ref-posture-hold-${Date.now()}`,
    );
    await request(app)
      .post(`/v1/admin/identity-reviews/${onHold.userId}/needs-further-review`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .send({});

    const actionable = await request(app)
      .get("/v1/admin/identity-reviews?status=PENDING&posture=actionable")
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(actionable.status).toBe(200);
    expect(
      actionable.body.data.reviews.every(
        (r: { adminReviewStatus: string }) => r.adminReviewStatus === "PENDING",
      ),
    ).toBe(true);

    const held = await request(app)
      .get("/v1/admin/identity-reviews?status=PENDING&posture=on_hold")
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(held.status).toBe(200);
    expect(
      held.body.data.reviews.some((r: { reviewId: string }) => r.reviewId === onHold.userId),
    ).toBe(true);

    const summary = await request(app)
      .get("/v1/admin/identity-reviews/summary")
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.data.pendingTotal).toBe(
      summary.body.data.pendingActionable + summary.body.data.pendingOnHold,
    );
  });

  it("paginates internal notes with cursor", async () => {
    const reviewer = await registerAndLogin(app, "rev-notes-page");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant-notes-page");
    await seedProviderApprovedApplicant(
      db,
      applicant.userId,
      randomUUID(),
      `ref-notes-page-${Date.now()}`,
    );

    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post(`/v1/admin/identity-reviews/${applicant.userId}/notes`)
        .set("Authorization", `Bearer ${reviewer.accessToken}`)
        .send({ body: `Note ${i}` });
    }

    const first = await request(app)
      .get(`/v1/admin/identity-reviews/${applicant.userId}/notes?limit=2`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(first.status).toBe(200);
    expect(first.body.data.notes).toHaveLength(2);
    expect(first.body.data.nextCursor).toBeTruthy();

    const nextCursor = first.body.data.nextCursor as string;
    const second = await request(app)
      .get(
        `/v1/admin/identity-reviews/${applicant.userId}/notes?limit=2&cursor=${encodeURIComponent(nextCursor)}`,
      )
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(second.status).toBe(200);
    expect(second.body.data.notes.length).toBeGreaterThanOrEqual(1);
  });

  it("fresh KYC session supersedes hold when returned to pending and rebound", async () => {
    const reviewer = await registerAndLogin(app, "rev-fresh-kyc");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant-fresh-kyc");
    const sessionId = randomUUID();
    const providerRef = `ref-fresh-kyc-${Date.now()}`;
    await seedProviderApprovedApplicant(db, applicant.userId, sessionId, providerRef);

    await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/needs-further-review`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .send({});

    await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/return-to-pending`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .send({});

    const body = JSON.stringify(mockApproveWebhookBody(providerRef, `evt-fresh-${Date.now()}`));
    await request(app)
      .post("/v1/webhooks/verification/mock")
      .set("Content-Type", "application/json")
      .set("x-hmac-signature", signMockWebhook(body))
      .send(body);

    const userRow = await db.user.findUniqueOrThrow({ where: { id: applicant.userId } });
    expect(userRow.adminReviewStatus).toBe("PENDING");
    expect(userRow.identityVerificationSessionId).toBe(sessionId);

    const approve = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(approve.status).toBe(200);
    expect(approve.body.data.adminReviewStatus).toBe("APPROVED");
  });

  it("creates and lists internal notes", async () => {
    const reviewer = await registerAndLogin(app, "rev-notes");
    await grantIdentityReviewer(db, reviewer.userId);
    const applicant = await registerAndLogin(app, "applicant-notes");
    await seedProviderApprovedApplicant(
      db,
      applicant.userId,
      randomUUID(),
      `ref-notes-${Date.now()}`,
    );

    const created = await request(app)
      .post(`/v1/admin/identity-reviews/${applicant.userId}/notes`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .send({ body: "Checked provider session metadata." });
    expect(created.status).toBe(201);

    const list = await request(app)
      .get(`/v1/admin/identity-reviews/${applicant.userId}/notes`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.notes.length).toBeGreaterThanOrEqual(1);
  });

  it("approve and reject regressions with idempotent approve replay", async () => {
    const reviewer = await registerAndLogin(app, "rev-regression-031f1");
    await grantIdentityReviewer(db, reviewer.userId);
    const toApprove = await registerAndLogin(app, "applicant-regression-approve");
    const toReject = await registerAndLogin(app, "applicant-regression-reject");
    await seedProviderApprovedApplicant(
      db,
      toApprove.userId,
      randomUUID(),
      `ref-reg-a-${Date.now()}`,
    );
    await seedProviderApprovedApplicant(
      db,
      toReject.userId,
      randomUUID(),
      `ref-reg-r-${Date.now()}`,
    );

    const key = `approve-reg-${randomUUID()}`;
    const first = await request(app)
      .post(`/v1/admin/identity-reviews/${toApprove.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .set("Idempotency-Key", key);
    const replay = await request(app)
      .post(`/v1/admin/identity-reviews/${toApprove.userId}/approve`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .set("Idempotency-Key", key);
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.body.data.idempotentReplay).toBe(true);

    const reject = await request(app)
      .post(`/v1/admin/identity-reviews/${toReject.userId}/reject`)
      .set("Authorization", `Bearer ${reviewer.accessToken}`)
      .send({ reasonCode: "POLICY_INELIGIBLE" });
    expect(reject.status).toBe(200);
    expect(reject.body.data.adminReviewStatus).toBe("REJECTED");
  });
});
