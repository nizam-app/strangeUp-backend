/** Distinct bounded context for merch orders (ADR-003); not Club subscription/IAP billing. */
export const PHYSICAL_COMMERCE_DOMAIN = "PHYSICAL_MERCHANDISE_ORDER" as const;

export const PHYSICAL_COMMERCE_MEMBERSHIP_BOUNDARY =
  "Digital Club membership billing and entitlements (D-08) are separate from physical merchandise orders. Order APIs must not activate, renew, or infer Club subscription state.";

export const STORE_ORDER_PLACEMENT_UNAVAILABLE = {
  placementStatus: "UNAVAILABLE" as const,
  reasonCode: "ORDER_PLACEMENT_NOT_CONFIGURED" as const,
  message:
    "Order creation, checkout, inventory reservation, and payment capture are not configured (MKT-03 / 024E gate).",
};

export const STORE_FULFILLMENT_SHIPPING_NOT_CONFIGURED = {
  status: "NOT_CONFIGURED" as const,
  reasonCode: "SHIPPING_POLICY_NOT_CONFIGURED" as const,
  message:
    "Shipping addresses, carriers, rates, and delivery promises require owner-approved fulfillment policy (MKT-03).",
};

export const STORE_FULFILLMENT_ACTIVITY_PICKUP_NOT_CONFIGURED = {
  status: "NOT_CONFIGURED" as const,
  reasonCode: "ACTIVITY_PICKUP_POLICY_NOT_CONFIGURED" as const,
  message:
    "Activity-linked pickup eligibility, handoff proof, and scheduling require owner-approved policy (MKT-03).",
};

export const STORE_FULFILLMENT_OWNER_DECISIONS = [
  "MKT-03: Shipping vs pickup vs both; address retention and privacy",
  "MKT-03: Activity-linked pickup — RSVP states, host handoff, inventory location",
  "MKT-03: Stock reservation TTL, oversell protection, cancellation/restock",
  "MKT-03: Order idempotency window and duplicate-submit policy",
  "ADR-003: Confirm physical-commerce schema separate from membership billing",
  "024E: Payment provider, tax, and chargeable checkout authorization",
] as const;

/** Documented lifecycle — not persisted until owner approves transactional orders. */
export const PHYSICAL_ORDER_LIFECYCLE_SPEC = [
  "DRAFT_QUOTE",
  "PENDING_PAYMENT",
  "PAID",
  "FULFILLMENT_PENDING",
  "FULFILLED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
] as const;
