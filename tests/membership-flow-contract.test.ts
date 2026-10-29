import { describe, expect, it } from "vitest";
import { buildMembershipFlowContract } from "../src/modules/membership/membership-flow-contract.js";
import { listMembershipPlanOffers } from "../src/modules/membership/membership-plan-registry.js";

describe("membership flow contract (Task 026A)", () => {
  it("declares owner-deferred billing and checkout", () => {
    const flow = buildMembershipFlowContract();
    expect(flow.billing.status).toBe("DEFERRED");
    expect(flow.checkout.purchasable).toBe(false);
    expect(flow.effectivePlan.trustedClubActivation).toBe(false);
    expect(flow.domainSeparation.physicalMarketplaceCheckout).toBe("UNAVAILABLE");
  });

  it("documents Figma pricing contradictions without live SKUs", () => {
    const flow = buildMembershipFlowContract();
    expect(flow.figmaEvidence.knownPricingContradictions.length).toBeGreaterThan(0);
    expect(flow.billingIntervalSelector.intervals.every((i) => i.club === "NOT_CONFIGURED")).toBe(
      true,
    );
  });

  it("aligns Club feature rows with DEFERRED checkout capabilities", () => {
    const club = listMembershipPlanOffers().find((p) => p.planId === "CLUB")!;
    const checkout = club.features.find((f) => f.key === "subscription_checkout");
    expect(checkout?.status).toBe("DEFERRED");
    const restore = club.features.find((f) => f.key === "restore_purchases");
    expect(restore?.status).toBe("DEFERRED");
  });
});
