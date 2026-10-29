import { describe, expect, it } from "vitest";
import { PHYSICAL_COMMERCE_DOMAIN } from "../src/modules/physical-commerce/physical-commerce.constants.js";
import {
  buildStoreFulfillmentPolicy,
  buildStoreCartFulfillmentQuote,
} from "../src/modules/physical-commerce/physical-commerce-fulfillment.service.js";

describe("physical commerce fulfillment contract (024D)", () => {
  it("declares separate merchandise domain", () => {
    const policy = buildStoreFulfillmentPolicy();
    expect(policy.domain).toBe(PHYSICAL_COMMERCE_DOMAIN);
    expect(policy.checkout.status).toBe("UNAVAILABLE");
  });

  it("exposes SHIPPING and ACTIVITY_PICKUP as NOT_CONFIGURED", () => {
    const quote = buildStoreCartFulfillmentQuote();
    expect(quote.methods).toHaveLength(2);
    expect(quote.methods.every((m) => m.status === "NOT_CONFIGURED")).toBe(true);
    expect(quote.selectedMethod).toBeNull();
  });
});
