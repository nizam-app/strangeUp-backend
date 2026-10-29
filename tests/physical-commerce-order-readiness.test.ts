import { describe, expect, it } from "vitest";
import { assessCartOrderReadiness } from "../src/modules/physical-commerce/physical-commerce-order-readiness.js";

describe("cart order readiness (024D)", () => {
  it("empty cart is not order eligible", () => {
    const r = assessCartOrderReadiness([]);
    expect(r.cartLinesOrderEligible).toBe(false);
    expect(r.reasonCode).toBe("ORDER_PLACEMENT_NOT_CONFIGURED");
  });

  it("all AVAILABLE lines are order-ready except placement still UNAVAILABLE", () => {
    const r = assessCartOrderReadiness([
      {
        variantId: "11111111-1111-4111-8111-111111111111",
        availability: "AVAILABLE",
        availabilityReason: null,
        quantity: 2,
        maxPurchasableQuantity: 5,
      },
    ]);
    expect(r.cartLinesOrderEligible).toBe(true);
    expect(r.blockedLines).toHaveLength(0);
    expect(r.reasonCode).toBe("ORDER_PLACEMENT_NOT_CONFIGURED");
    expect(r.insufficientStockNeverAutoReduced).toBe(true);
  });

  it("INSUFFICIENT_STOCK blocks order without implying reduced quantity", () => {
    const variantId = "22222222-2222-4222-8222-222222222222";
    const r = assessCartOrderReadiness([
      {
        variantId,
        availability: "INSUFFICIENT_STOCK",
        availabilityReason: "INSUFFICIENT_STOCK",
        quantity: 4,
        maxPurchasableQuantity: 2,
      },
    ]);
    expect(r.cartLinesOrderEligible).toBe(false);
    expect(r.reasonCode).toBe("CART_LINES_NOT_ORDER_READY");
    expect(r.blockedLines[0].blockReasonCode).toBe("INSUFFICIENT_STOCK");
    expect(r.blockedLines[0].variantId).toBe(variantId);
  });
});
