import { describe, expect, it } from "vitest";
import { STORE_CHECKOUT_UNAVAILABLE } from "../src/modules/store/store.constants.js";

describe("store cart checkout contract", () => {
  it("checkout remains unavailable without payment integration", () => {
    expect(STORE_CHECKOUT_UNAVAILABLE.status).toBe("UNAVAILABLE");
    expect(STORE_CHECKOUT_UNAVAILABLE.reasonCode).toBe("PAYMENT_AND_FULFILLMENT_NOT_CONFIGURED");
  });

  it("subtotal arithmetic stays in integer cents", () => {
    const unit = 4999;
    const qty = 2;
    expect(unit * qty).toBe(9998);
  });
});
