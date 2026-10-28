import { describe, expect, it } from "vitest";
import {
  computeEffectiveApplicationAccess,
  hasHomeAccess,
  resolveOnboardingNextAction,
  resolveOnboardingPhase,
} from "../src/modules/policy/effective-access-policy.js";
import { baseEligibleActor, mainAppActivatedActor } from "./helpers/activation-fixtures.js";

describe("effective access policy (Task 022A)", () => {
  it("denies Home without admin approval even when provider KYC is approved", () => {
    const actor = baseEligibleActor({
      identityVerificationStatus: "APPROVED",
      identityVerificationApprovedAt: new Date(),
      identityVerificationSessionId: "11111111-1111-4111-8111-111111111111",
      adminReviewStatus: "PENDING",
      adminReviewVerificationSessionId: "11111111-1111-4111-8111-111111111111",
    });
    expect(hasHomeAccess(actor)).toBe(false);
    expect(computeEffectiveApplicationAccess({ actor })).toBe("WAITING_FOR_ADMIN_REVIEW");
  });

  it("grants Home only when admin approval matches current identity session", () => {
    expect(hasHomeAccess(mainAppActivatedActor())).toBe(true);
    expect(
      hasHomeAccess(
        mainAppActivatedActor({
          adminReviewVerificationSessionId: "99999999-9999-4999-8999-999999999999",
        }),
      ),
    ).toBe(false);
  });

  it("maps ADMIN_REJECTED phase and next action", () => {
    const actor = baseEligibleActor({
      identityVerificationStatus: "APPROVED",
      identityVerificationApprovedAt: new Date(),
      identityVerificationSessionId: "11111111-1111-4111-8111-111111111111",
      adminReviewStatus: "REJECTED",
      adminReviewVerificationSessionId: "11111111-1111-4111-8111-111111111111",
    });
    expect(
      resolveOnboardingPhase({
        actor,
        effectiveAccess: "DENIED",
        emailVerificationStatus: "VERIFIED",
        canRetryVerification: false,
      }),
    ).toBe("ADMIN_REJECTED");
    expect(
      resolveOnboardingNextAction({
        actor,
        effectiveAccess: "DENIED",
        canStartVerification: false,
        canRetryVerification: false,
        emailVerificationStatus: "VERIFIED",
      }),
    ).toBe("ADMIN_REJECTED");
  });

  it("maps onboarding next actions for email and IDV steps", () => {
    const pendingEmail = baseEligibleActor({
      accountStatus: "PENDING_VERIFICATION",
      emailVerifiedAt: null,
    });
    expect(
      resolveOnboardingNextAction({
        actor: pendingEmail,
        effectiveAccess: "ONBOARDING_REQUIRED",
        canStartVerification: false,
        canRetryVerification: false,
        emailVerificationStatus: "UNVERIFIED",
      }),
    ).toBe("VERIFY_EMAIL");

    const readyForIdv = baseEligibleActor();
    expect(
      resolveOnboardingNextAction({
        actor: readyForIdv,
        effectiveAccess: "ONBOARDING_REQUIRED",
        canStartVerification: true,
        canRetryVerification: false,
        emailVerificationStatus: "VERIFIED",
      }),
    ).toBe("START_IDENTITY_VERIFICATION");
  });
});
