import { describe, expect, it } from "vitest";
import { listMembershipPlanOffers } from "../src/modules/membership/membership-plan-registry.js";

describe("membership plan catalog (Task 017)", () => {
  it("exposes BASIC as available free tier and CLUB as not configured", () => {
    const plans = listMembershipPlanOffers();
    expect(plans).toHaveLength(2);

    const basic = plans.find((p) => p.planId === "BASIC")!;
    expect(basic.availability).toBe("AVAILABLE");
    expect(basic.purchasable).toBe(false);
    expect(basic.pricing?.monthlyAmountCents).toBe(0);
    expect(basic.pricing?.configured).toBe(true);

    const club = plans.find((p) => p.planId === "CLUB")!;
    expect(club.availability).toBe("NOT_CONFIGURED");
    expect(club.purchasable).toBe(false);
    expect(club.pricing).toBeNull();
  });

  it("does not advertise Figma trial or annual Club pricing", () => {
    const club = listMembershipPlanOffers().find((p) => p.planId === "CLUB")!;
    expect(club.pricing).toBeNull();
    const applePay = club.features.find((f) => f.key === "apple_pay_checkout");
    expect(applePay?.status).toBe("UNAVAILABLE");
  });
});
