import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../../src/infrastructure/database/prisma.js";
import { upsertStaffGrant } from "../../src/modules/admin/platform-staff-bootstrap.js";
import { IDENTITY_REVIEWER_ROLE } from "../../src/modules/admin/platform-staff-policy.js";
import { computeHmacSha256Hex } from "../../src/modules/verification/webhook-signature.js";

export const KYC_TEST_WEBHOOK_SECRET = "test-webhook-secret-min-32-characters!";

export async function grantIdentityReviewer(db: DatabaseClient, userId: string): Promise<void> {
  await upsertStaffGrant(db, userId, IDENTITY_REVIEWER_ROLE, null);
}

/** Email-verified active user with mock provider session approved and admin queue PENDING. */
/** Provider-approved identity + StrangeUp admin approval (main-app / Home access in tests). */
export async function seedMainAppActivatedUser(
  db: DatabaseClient,
  userId: string,
  sessionId: string = randomUUID(),
): Promise<{ sessionId: string; providerSessionRef: string }> {
  const providerSessionRef = `mock-ref-${sessionId}`;
  await seedProviderApprovedApplicant(db, userId, sessionId, providerSessionRef);
  await db.user.update({
    where: { id: userId },
    data: {
      adminReviewStatus: "APPROVED",
      adminReviewDecidedAt: new Date(),
    },
  });
  return { sessionId, providerSessionRef };
}

export async function seedProviderApprovedApplicant(
  db: DatabaseClient,
  userId: string,
  sessionId: string,
  providerSessionRef: string,
): Promise<void> {
  await db.verificationSession.create({
    data: {
      id: sessionId,
      userId,
      provider: "MOCK",
      providerSessionRef,
      status: "APPROVED",
      sessionExpiresAt: new Date(Date.now() + 3_600_000),
      completedAt: new Date(),
    },
  });
  await db.user.update({
    where: { id: userId },
    data: {
      accountStatus: "ACTIVE",
      emailVerifiedAt: new Date(),
      ageEligibilityStatus: "ELIGIBLE",
      identityVerificationStatus: "APPROVED",
      identityVerificationApprovedAt: new Date(),
      identityVerificationSessionId: sessionId,
      adminReviewStatus: "PENDING",
      adminReviewVerificationSessionId: sessionId,
      adminReviewDecidedAt: null,
    },
  });
}

export function mockApproveWebhookBody(providerSessionRef: string, eventId: string) {
  return {
    id: eventId,
    action: "verification.decision" as const,
    verification: {
      id: providerSessionRef,
      status: "approved" as const,
    },
  };
}

export function signMockWebhook(bodyText: string): string {
  return computeHmacSha256Hex(KYC_TEST_WEBHOOK_SECRET, Buffer.from(bodyText, "utf8"));
}
