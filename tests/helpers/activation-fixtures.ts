import type { ActivationPolicyActor } from "../../src/modules/policy/effective-access-policy.js";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

export function baseEligibleActor(
  overrides?: Partial<ActivationPolicyActor>,
): ActivationPolicyActor {
  return {
    userId: "22222222-2222-4222-8222-222222222222",
    accountStatus: "ACTIVE",
    emailVerifiedAt: new Date(),
    ageEligibilityStatus: "ELIGIBLE",
    suspendedAt: null,
    deletedAt: null,
    identityVerificationStatus: "NOT_STARTED",
    identityVerificationApprovedAt: null,
    identityVerificationValidUntil: null,
    identityVerificationRevokedAt: null,
    identityVerificationSessionId: null,
    adminReviewStatus: "NOT_READY",
    adminReviewVerificationSessionId: null,
    ...overrides,
  };
}

/** Adult with provider KYC + StrangeUp admin approval (main-app access; email verify not required — Task 031B.2). */
export function mainAppActivatedActor(
  overrides?: Partial<ActivationPolicyActor>,
): ActivationPolicyActor {
  return baseEligibleActor({
    identityVerificationStatus: "APPROVED",
    identityVerificationApprovedAt: new Date(),
    identityVerificationSessionId: SESSION_ID,
    adminReviewStatus: "APPROVED",
    adminReviewVerificationSessionId: SESSION_ID,
    ...overrides,
  });
}
