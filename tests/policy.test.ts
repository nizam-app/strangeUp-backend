import { describe, expect, it } from "vitest";
import {
  canAccessAccount,
  canChangePassword,
  canEditProfile,
  canInteractWithUser,
  hasFullAccountAccess,
} from "../src/modules/policy/account-policy.js";

const activeVerified = {
  userId: "u1",
  accountStatus: "ACTIVE" as const,
  emailVerifiedAt: new Date(),
  ageEligibilityStatus: "ELIGIBLE" as const,
  suspendedAt: null,
  deletedAt: null,
};

describe("account policy stubs", () => {
  it("denies cross-user interaction (D-03)", () => {
    expect(canInteractWithUser(activeVerified, "u2")).toBe(false);
  });

  it("allows own account access when pending verification", () => {
    expect(
      canAccessAccount(
        { ...activeVerified, accountStatus: "PENDING_VERIFICATION", emailVerifiedAt: null },
        "u1",
      ),
    ).toBe(true);
  });

  it("allows password change for pending verification (same as account read)", () => {
    expect(
      canChangePassword(
        { ...activeVerified, accountStatus: "PENDING_VERIFICATION", emailVerifiedAt: null },
        "u1",
      ),
    ).toBe(true);
    expect(canChangePassword(activeVerified, "u2")).toBe(false);
  });

  it("requires verification for profile edit", () => {
    expect(
      canEditProfile(
        { ...activeVerified, accountStatus: "PENDING_VERIFICATION", emailVerifiedAt: null },
        "u1",
      ),
    ).toBe(false);
    expect(canEditProfile(activeVerified, "u1")).toBe(true);
  });

  it("denies profile edit when suspended", () => {
    expect(
      canEditProfile(
        {
          ...activeVerified,
          accountStatus: "SUSPENDED",
          suspendedAt: new Date(),
        },
        "u1",
      ),
    ).toBe(false);
  });

  it("denies access when accountStatus is SUSPENDED without suspendedAt timestamp", () => {
    expect(
      canAccessAccount(
        {
          ...activeVerified,
          accountStatus: "SUSPENDED",
          suspendedAt: null,
        },
        "u1",
      ),
    ).toBe(false);
  });

  it("computes full access from separate trust dimensions", () => {
    expect(hasFullAccountAccess(activeVerified)).toBe(true);
    expect(
      hasFullAccountAccess({
        ...activeVerified,
        emailVerifiedAt: null,
        accountStatus: "PENDING_VERIFICATION",
      }),
    ).toBe(false);
  });
});
