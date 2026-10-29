import {
  PHYSICAL_COMMERCE_DOMAIN,
  PHYSICAL_COMMERCE_MEMBERSHIP_BOUNDARY,
  PHYSICAL_ORDER_LIFECYCLE_SPEC,
  STORE_FULFILLMENT_ACTIVITY_PICKUP_NOT_CONFIGURED,
  STORE_FULFILLMENT_OWNER_DECISIONS,
  STORE_FULFILLMENT_SHIPPING_NOT_CONFIGURED,
} from "./physical-commerce.constants.js";
import type {
  ActivityPickupEligibilitySpecDto,
  StoreCartFulfillmentQuoteDto,
  StoreFulfillmentMethodCapabilityDto,
  StoreFulfillmentPolicyDto,
} from "./physical-commerce.types.js";

export function buildFulfillmentMethodCapabilities(): StoreFulfillmentMethodCapabilityDto[] {
  return [
    {
      method: "SHIPPING",
      ...STORE_FULFILLMENT_SHIPPING_NOT_CONFIGURED,
      selectable: false,
    },
    {
      method: "ACTIVITY_PICKUP",
      ...STORE_FULFILLMENT_ACTIVITY_PICKUP_NOT_CONFIGURED,
      selectable: false,
    },
  ];
}

export function buildStoreFulfillmentPolicy(): StoreFulfillmentPolicyDto {
  return {
    domain: PHYSICAL_COMMERCE_DOMAIN,
    membershipBillingSeparation: PHYSICAL_COMMERCE_MEMBERSHIP_BOUNDARY,
    methods: buildFulfillmentMethodCapabilities(),
    selectionStatus: "NOT_CONFIGURED",
    ownerDecisions: [...STORE_FULFILLMENT_OWNER_DECISIONS],
    orderLifecycleSpec: PHYSICAL_ORDER_LIFECYCLE_SPEC,
    stockSnapshotPolicy:
      "Order lines must snapshot catalog unit price and requested quantity only when every line is AVAILABLE at full quantity; INSUFFICIENT_STOCK lines block order readiness.",
    idempotencyPolicy:
      "Future POST /orders (024E+) must accept Idempotency-Key (8–128 chars); replay returns same order id without double stock decrement.",
    checkout: {
      status: "UNAVAILABLE" as const,
      reasonCode: "PAYMENT_AND_FULFILLMENT_NOT_CONFIGURED" as const,
    },
  };
}

export function buildStoreCartFulfillmentQuote(): StoreCartFulfillmentQuoteDto {
  return {
    domain: PHYSICAL_COMMERCE_DOMAIN,
    methods: buildFulfillmentMethodCapabilities(),
    selectionStatus: "NOT_CONFIGURED",
    selectedMethod: null,
    activityPickup: {
      status: "NOT_CONFIGURED",
      activityId: null,
      eligibility: null,
    },
    shipping: {
      status: "NOT_CONFIGURED",
      addressSnapshot: null,
    },
  };
}

export function buildActivityPickupEligibilitySpec(): ActivityPickupEligibilitySpecDto {
  return {
    status: "NOT_CONFIGURED",
    requirements: {
      activityStatus: "PUBLISHED",
      participationStatesEligible: ["CONFIRMED"],
      pickupMustNotMutateRsvp: true,
      handoffProofRequired: "OWNER_DECISION",
      leaderDisplayNameTrust: "SERVER_VERIFIED_HOST_ONLY",
    },
    message:
      "Activity pickup validation is specified but not enforced until MKT-03 approves handoff rules and order persistence exists.",
  };
}
