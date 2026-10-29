import { describe, expect, it } from "vitest";
import {
  aggregateCartTotals,
  resolveCartLineAvailability,
} from "../src/modules/store/store-cart-lines.js";
import { STORE_CHECKOUT_UNAVAILABLE, STORE_SUBTOTAL_DISCLAIMER } from "../src/modules/store/store.constants.js";

const publishedActive = {
  isActive: true,
  stockQuantity: 5,
  product: { status: "PUBLISHED" },
};

describe("store cart checkout contract", () => {
  it("checkout remains unavailable without payment integration", () => {
    expect(STORE_CHECKOUT_UNAVAILABLE.status).toBe("UNAVAILABLE");
    expect(STORE_CHECKOUT_UNAVAILABLE.reasonCode).toBe("PAYMENT_AND_FULFILLMENT_NOT_CONFIGURED");
  });

  it("subtotal disclaimer documents fulfillable vs display semantics", () => {
    expect(STORE_SUBTOTAL_DISCLAIMER).toMatch(/subtotalCents/i);
    expect(STORE_SUBTOTAL_DISCLAIMER).toMatch(/linesSubtotalCents/i);
  });
});

describe("resolveCartLineAvailability", () => {
  it("AVAILABLE line uses full quantity in both subtotals", () => {
    const line = resolveCartLineAvailability({
      quantity: 2,
      unitPriceCents: 4500,
      currency: "USD",
      variant: publishedActive,
    });
    expect(line.availability).toBe("AVAILABLE");
    expect(line.lineSubtotalCents).toBe(9000);
    expect(line.eligibleLineSubtotalCents).toBe(9000);
    expect(line.maxPurchasableQuantity).toBe(5);
  });

  it("INSUFFICIENT_STOCK excludes full requested qty from eligible subtotal", () => {
    const line = resolveCartLineAvailability({
      quantity: 4,
      unitPriceCents: 1000,
      currency: "USD",
      variant: { ...publishedActive, stockQuantity: 2 },
    });
    expect(line.availability).toBe("INSUFFICIENT_STOCK");
    expect(line.availabilityReason).toBe("INSUFFICIENT_STOCK");
    expect(line.lineSubtotalCents).toBe(4000);
    expect(line.eligibleLineSubtotalCents).toBe(2000);
    expect(line.maxPurchasableQuantity).toBe(2);
  });

  it("zero stock line is INSUFFICIENT_STOCK with zero eligible value", () => {
    const line = resolveCartLineAvailability({
      quantity: 1,
      unitPriceCents: 4999,
      currency: "USD",
      variant: { ...publishedActive, stockQuantity: 0 },
    });
    expect(line.availability).toBe("INSUFFICIENT_STOCK");
    expect(line.lineSubtotalCents).toBe(4999);
    expect(line.eligibleLineSubtotalCents).toBe(0);
    expect(line.maxPurchasableQuantity).toBe(0);
  });

  it("unpublished product is UNAVAILABLE with zero subtotals", () => {
    const line = resolveCartLineAvailability({
      quantity: 1,
      unitPriceCents: 100,
      currency: "USD",
      variant: { ...publishedActive, product: { status: "DRAFT" } },
    });
    expect(line.availability).toBe("UNAVAILABLE");
    expect(line.availabilityReason).toBe("PRODUCT_NOT_PUBLISHED");
    expect(line.lineSubtotalCents).toBe(0);
    expect(line.eligibleLineSubtotalCents).toBe(0);
  });

  it("inactive variant is UNAVAILABLE", () => {
    const line = resolveCartLineAvailability({
      quantity: 1,
      unitPriceCents: 100,
      currency: "USD",
      variant: { ...publishedActive, isActive: false },
    });
    expect(line.availability).toBe("UNAVAILABLE");
    expect(line.availabilityReason).toBe("VARIANT_INACTIVE");
  });
});

describe("aggregateCartTotals", () => {
  it("subtotalCents excludes ineligible portions of mixed cart", () => {
    const available = resolveCartLineAvailability({
      quantity: 2,
      unitPriceCents: 4500,
      currency: "USD",
      variant: publishedActive,
    });
    const insufficient = resolveCartLineAvailability({
      quantity: 10,
      unitPriceCents: 1000,
      currency: "USD",
      variant: { ...publishedActive, stockQuantity: 3 },
    });
    const totals = aggregateCartTotals([available, insufficient]);
    expect(totals.subtotalCents).toBe(9000 + 3000);
    expect(totals.linesSubtotalCents).toBe(9000 + 10000);
    expect(totals.hasInsufficientStock).toBe(true);
    expect(totals.allLinesPurchasable).toBe(false);
    expect(totals.eligibleLineCount).toBe(1);
    expect(totals.ineligibleLineCount).toBe(1);
  });

  it("empty cart totals are zero with allLinesPurchasable false", () => {
    const totals = aggregateCartTotals([]);
    expect(totals.subtotalCents).toBe(0);
    expect(totals.linesSubtotalCents).toBe(0);
    expect(totals.allLinesPurchasable).toBe(false);
  });
});
