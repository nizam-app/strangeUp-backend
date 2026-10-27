import { describe, expect, it } from "vitest";
import {
  buildSelfMembership,
  resolveEffectivePlanId,
  userHasClubEntitlement,
} from "../src/modules/membership/membership-entitlements.js";

describe("membership entitlements (Task 017)", () => {
  it("defaults every user to BASIC without persisted subscription", () => {
    expect(resolveEffectivePlanId("any-user-id")).toBe("BASIC");
    expect(userHasClubEntitlement("any-user-id")).toBe(false);
  });

  it("returns truthful self membership without billing artifacts", () => {
    const dto = buildSelfMembership("user-1");
    expect(dto.planId).toBe("BASIC");
    expect(dto.tierKind).toBe("FREE");
    expect(dto.billingStatus).toBe("NOT_CONFIGURED");
    expect(dto.canUpgrade).toBe(false);
    expect(dto.upgradeBlockedReasons.length).toBeGreaterThan(0);
    expect(dto.trial).toBeNull();
    expect(dto.subscription).toBeNull();
    expect(dto.nextBillingAt).toBeNull();
    expect(dto.paymentMethod).toBeNull();
  });

  it("does not mark Figma-only caps as enforced", () => {
    const dto = buildSelfMembership("user-1");
    const cap = dto.entitlements.capabilities.find((c) => c.key === "monthly_activity_join_cap");
    expect(cap?.status).toBe("POLICY_PENDING");
    expect(cap?.enforced).toBe(false);
    expect(cap?.figmaIllustrationOnly).toBe(true);
  });
});
