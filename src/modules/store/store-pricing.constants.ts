import type { StorePricingModel } from "./store-pricing.types.js";

export const STORE_PRICING_MODEL: StorePricingModel = "LIST_PRICE_PLUS_SINGLE_CART_DISCOUNT";

export const STORE_ANTI_DOUBLE_DISCOUNT_POLICY =
  "Catalog variant priceCents is the list/base unit price. When membership merchandise benefits are authorized, the server applies at most one membership adjustment on the quote (aggregated cart discount). Explicit per-line member unit prices and a separate membership discount line are mutually exclusive.";

export const STORE_MEMBERSHIP_DISCOUNT_NOT_CONFIGURED = {
  status: "NOT_CONFIGURED" as const,
  reasonCode: "MEMBERSHIP_MERCH_DISCOUNT_PENDING_D08" as const,
  message:
    "Club merchandise discount percentage, eligibility rules, and billing-backed CLUB entitlement are not owner-approved (D-08). Do not display Figma sample member prices or savings.",
};

export const STORE_SHIPPING_NOT_CONFIGURED = {
  status: "NOT_CONFIGURED" as const,
  reasonCode: "FULFILLMENT_NOT_CONFIGURED" as const,
  message: "Shipping and free-shipping thresholds are not configured (MKT-03).",
};

export const STORE_TAX_NOT_CONFIGURED = {
  status: "NOT_CONFIGURED" as const,
  reasonCode: "TAX_POLICY_NOT_CONFIGURED" as const,
  message: "Tax jurisdiction and calculation are not configured (MKT-03).",
};

export const STORE_PRICING_OWNER_DECISIONS = [
  "D-08: Club billing, purchasable plan, and trusted CLUB entitlement source",
  "MKT-03: Merchandise discount percentage/basis points and eligible catalog scope",
  "MKT-03: Free-shipping threshold and eligible subtotal definition",
  "Resolved Figma conflict: member line prices vs cart-level Club discount (canonical model: list + single cart discount)",
] as const;
