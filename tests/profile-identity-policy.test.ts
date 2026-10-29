import { describe, expect, it } from "vitest";
import {
  isLegalNameLocked,
  isLegalNameLockedFromSnapshot,
  profilePatchTouchesLegalName,
} from "../src/modules/me/profile-identity-policy.js";
import { mainAppActivatedActor } from "./helpers/activation-fixtures.js";

const ctx = { isProduction: false, kycProviderEnabled: false };

describe("profile identity policy (Task 025D / 025E)", () => {
  it("locks legal names after trusted KYC approval", () => {
    const activated = mainAppActivatedActor();
    const user = {
      identityVerificationStatus: activated.identityVerificationStatus,
      identityVerificationApprovedAt: activated.identityVerificationApprovedAt,
      identityVerificationValidUntil: activated.identityVerificationValidUntil,
      identityVerificationRevokedAt: activated.identityVerificationRevokedAt,
    };
    expect(isLegalNameLocked(user as never, ctx)).toBe(true);
    expect(
      isLegalNameLocked(
        {
          identityVerificationStatus: "NOT_STARTED",
          identityVerificationApprovedAt: null,
          identityVerificationValidUntil: null,
          identityVerificationRevokedAt: null,
        } as never,
        ctx,
      ),
    ).toBe(false);
  });

  it("025E: stays locked when enforcement lapses but approvedAt remains", () => {
    const past = new Date(Date.now() - 86_400_000);
    expect(
      isLegalNameLockedFromSnapshot(
        {
          identityVerificationStatus: "EXPIRED",
          identityVerificationApprovedAt: past,
          identityVerificationValidUntil: past,
          identityVerificationRevokedAt: null,
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("025E: stays locked when KYC revoked even if status is not APPROVED", () => {
    expect(
      isLegalNameLockedFromSnapshot(
        {
          identityVerificationStatus: "APPROVED",
          identityVerificationApprovedAt: null,
          identityVerificationValidUntil: null,
          identityVerificationRevokedAt: new Date(),
        },
        ctx,
      ),
    ).toBe(true);
  });

  it("025E: unlocked when never approved and no sticky signals", () => {
    expect(
      isLegalNameLockedFromSnapshot(
        {
          identityVerificationStatus: "EXPIRED",
          identityVerificationApprovedAt: null,
          identityVerificationValidUntil: new Date(),
          identityVerificationRevokedAt: null,
        },
        ctx,
      ),
    ).toBe(false);
  });

  it("detects legal name patch attempts", () => {
    expect(profilePatchTouchesLegalName({})).toBe(false);
    expect(profilePatchTouchesLegalName({ firstName: "A" })).toBe(true);
    expect(profilePatchTouchesLegalName({ lastName: "B" })).toBe(true);
  });
});
