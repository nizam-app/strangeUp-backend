import { describe, expect, it } from "vitest";
import {
  canAccessAccount,
  canChangePassword,
  canEditProfile,
  canInteractWithUser,
  hasFullAccountAccess,
} from "../src/modules/policy/account-policy.js";
import { baseEligibleActor, mainAppActivatedActor } from "./helpers/activation-fixtures.js";

describe("account policy stubs", () => {
  it("denies cross-user interaction (D-03)", () => {
    expect(canInteractWithUser(mainAppActivatedActor(), "u2")).toBe(false);
  });

  it("allows own account access when pending verification", () => {
    expect(
      canAccessAccount(
        baseEligibleActor({
          accountStatus: "PENDING_VERIFICATION",
          emailVerifiedAt: null,
        }),
        baseEligibleActor().userId,
      ),
    ).toBe(true);
  });

  it("allows password change for pending verification (same as account read)", () => {
    const pending = baseEligibleActor({
      accountStatus: "PENDING_VERIFICATION",
      emailVerifiedAt: null,
    });
    expect(canChangePassword(pending, pending.userId)).toBe(true);
    expect(canChangePassword(pending, "other-user")).toBe(false);
  });

  it("requires verification for profile edit", () => {
    expect(
      canEditProfile(
        baseEligibleActor({
          accountStatus: "PENDING_VERIFICATION",
          emailVerifiedAt: null,
        }),
        baseEligibleActor().userId,
      ),
    ).toBe(false);
    expect(canEditProfile(baseEligibleActor(), baseEligibleActor().userId)).toBe(true);
  });

  it("denies profile edit when suspended", () => {
    expect(
      canEditProfile(
        baseEligibleActor({
          accountStatus: "SUSPENDED",
          suspendedAt: new Date(),
        }),
        baseEligibleActor().userId,
      ),
    ).toBe(false);
  });

  it("denies access when accountStatus is SUSPENDED without suspendedAt timestamp", () => {
    expect(
      canAccessAccount(
        baseEligibleActor({
          accountStatus: "SUSPENDED",
          suspendedAt: null,
        }),
        baseEligibleActor().userId,
      ),
    ).toBe(false);
  });

  it("computes full access only with admin + provider KYC alignment", () => {
    expect(hasFullAccountAccess(mainAppActivatedActor())).toBe(true);
    expect(hasFullAccountAccess(baseEligibleActor())).toBe(false);
    expect(
      hasFullAccountAccess(
        baseEligibleActor({
          accountStatus: "PENDING_VERIFICATION",
          emailVerifiedAt: null,
        }),
      ),
    ).toBe(false);
  });
});
