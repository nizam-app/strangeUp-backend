import { describe, expect, it } from "vitest";
import { STORE_PRICING_MODEL } from "../src/modules/store/store-pricing.constants.js";
import {
  buildStoreCartPricingQuote,
  buildStoreMerchandisePricingPolicy,
  buildStoreUnitPricing,
} from "../src/modules/store/store-pricing.service.js";

describe("store merchandise pricing contract (024C)", () => {
  it("uses list price + single cart discount model", () => {
    const policy = buildStoreMerchandisePricingPolicy();
    expect(policy.model).toBe(STORE_PRICING_MODEL);
    expect(policy.membershipDiscount.status).toBe("NOT_CONFIGURED");
    expect(policy.checkout.status).toBe("UNAVAILABLE");
  });

  it("unit pricing keeps list price authoritative and member price null", () => {
    const unit = buildStoreUnitPricing({
      listUnitPriceCents: 4500,
      compareAtUnitPriceCents: 5500,
      currency: "USD",
    });
    expect(unit.listUnitPriceCents).toBe(4500);
    expect(unit.memberUnitPriceCents).toBeNull();
    expect(unit.membershipAdjustment.status).toBe("NOT_CONFIGURED");
  });

  it("cart quote mirrors catalog subtotal without inventing discount cents", () => {
    const quote = buildStoreCartPricingQuote({
      userId: "user-1",
      catalogSubtotalCents: 9000,
      currency: "USD",
    });
    expect(quote.catalogSubtotalCents).toBe(9000);
    expect(quote.membershipDiscount.discountCents).toBeNull();
    expect(quote.membershipDiscount.percentBasisPoints).toBeNull();
    expect(quote.membershipDiscount.status).toBe("NOT_CONFIGURED");
    expect(quote.shipping.amountCents).toBeNull();
    expect(quote.tax.amountCents).toBeNull();
    expect(quote.totalDueCents).toBeNull();
    expect(quote.viewer.effectivePlanId).toBe("BASIC");
    expect(quote.viewer.clubMerchandiseBenefitEligible).toBe(false);
    expect(quote.viewer.clubBenefitIneligibleReasonCode).toBe("CLUB_NOT_PURCHASABLE");
  });

  it("documents anti-double-discount policy text", () => {
    const quote = buildStoreCartPricingQuote({
      userId: "u",
      catalogSubtotalCents: 0,
      currency: "USD",
    });
    expect(quote.antiDoubleDiscountPolicy).toMatch(/mutually exclusive/i);
  });
});
