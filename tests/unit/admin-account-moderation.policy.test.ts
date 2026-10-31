import { describe, expect, it } from "vitest";
import {
  resolveAccountModerationCapabilities,
  restoreAccountStatusFromPrior,
} from "../../src/modules/admin/admin-account-moderation.policy.js";

const actor = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";

describe("admin account moderation policy", () => {
  it("denies IDENTITY_REVIEWER-only actors", () => {
    const caps = resolveAccountModerationCapabilities({
      actorUserId: actor,
      actorIsSuperAdmin: false,
      target: { userId: target, accountStatus: "ACTIVE", deletedAt: null },
      targetHasActiveStaffGrant: false,
    });
    expect(caps.canSuspend).toBe(false);
    expect(caps.canRestore).toBe(false);
    expect(caps.blockedReason).toBe("NOT_SUPER_ADMIN");
  });

  it("prevents self-suspension and staff-account manipulation", () => {
    expect(
      resolveAccountModerationCapabilities({
        actorUserId: actor,
        actorIsSuperAdmin: true,
        target: { userId: actor, accountStatus: "ACTIVE", deletedAt: null },
        targetHasActiveStaffGrant: true,
      }).blockedReason,
    ).toBe("SELF");

    expect(
      resolveAccountModerationCapabilities({
        actorUserId: actor,
        actorIsSuperAdmin: true,
        target: { userId: target, accountStatus: "ACTIVE", deletedAt: null },
        targetHasActiveStaffGrant: true,
      }).blockedReason,
    ).toBe("STAFF_ACCOUNT");
  });

  it("allows suspend of active users and restore of suspended users", () => {
    const suspend = resolveAccountModerationCapabilities({
      actorUserId: actor,
      actorIsSuperAdmin: true,
      target: { userId: target, accountStatus: "ACTIVE", deletedAt: null },
      targetHasActiveStaffGrant: false,
    });
    expect(suspend.canSuspend).toBe(true);
    expect(suspend.canRestore).toBe(false);

    const restore = resolveAccountModerationCapabilities({
      actorUserId: actor,
      actorIsSuperAdmin: true,
      target: { userId: target, accountStatus: "SUSPENDED", deletedAt: null },
      targetHasActiveStaffGrant: false,
    });
    expect(restore.canSuspend).toBe(false);
    expect(restore.canRestore).toBe(true);
  });

  it("restores prior account status without inventing approval", () => {
    expect(restoreAccountStatusFromPrior("PENDING_VERIFICATION")).toBe("PENDING_VERIFICATION");
    expect(restoreAccountStatusFromPrior("ACTIVE")).toBe("ACTIVE");
    expect(restoreAccountStatusFromPrior(null)).toBe("ACTIVE");
  });
});
