import type { CartLineAvailability } from "../store/store-cart-lines.js";
import { PHYSICAL_COMMERCE_DOMAIN } from "./physical-commerce.constants.js";

export type PhysicalCommerceDomain = typeof PHYSICAL_COMMERCE_DOMAIN;

export type StoreFulfillmentMethod = "SHIPPING" | "ACTIVITY_PICKUP";

export type StoreFulfillmentCapabilityStatus = "NOT_CONFIGURED" | "UNAVAILABLE" | "AVAILABLE";

export type StoreFulfillmentMethodCapabilityDto = {
  method: StoreFulfillmentMethod;
  status: StoreFulfillmentCapabilityStatus;
  reasonCode: string;
  message: string;
  selectable: boolean;
};

export type StoreFulfillmentPolicyDto = {
  domain: PhysicalCommerceDomain;
  membershipBillingSeparation: string;
  methods: StoreFulfillmentMethodCapabilityDto[];
  selectionStatus: "NOT_CONFIGURED";
  ownerDecisions: string[];
  orderLifecycleSpec: readonly string[];
  stockSnapshotPolicy: string;
  idempotencyPolicy: string;
  checkout: {
    status: "UNAVAILABLE";
    reasonCode: "PAYMENT_AND_FULFILLMENT_NOT_CONFIGURED";
  };
};

export type StoreCartFulfillmentQuoteDto = {
  domain: PhysicalCommerceDomain;
  methods: StoreFulfillmentMethodCapabilityDto[];
  selectionStatus: "NOT_CONFIGURED";
  selectedMethod: null;
  activityPickup: {
    status: "NOT_CONFIGURED";
    activityId: null;
    eligibility: null;
  };
  shipping: {
    status: "NOT_CONFIGURED";
    addressSnapshot: null;
  };
};

export type StoreOrderReadinessBlockedLineDto = {
  variantId: string;
  availability: CartLineAvailability;
  blockReasonCode:
    | "INSUFFICIENT_STOCK"
    | "PRODUCT_NOT_PUBLISHED"
    | "VARIANT_INACTIVE"
    | "LINE_NOT_FULLY_AVAILABLE";
  message: string;
};

export type StoreOrderReadinessDto = {
  placementStatus: "UNAVAILABLE";
  reasonCode: "ORDER_PLACEMENT_NOT_CONFIGURED" | "CART_LINES_NOT_ORDER_READY";
  message: string;
  allLinesFullyAvailable: boolean;
  /** False when any line is not AVAILABLE at requested quantity — never auto-reduce for orders. */
  cartLinesOrderEligible: boolean;
  blockedLines: StoreOrderReadinessBlockedLineDto[];
  stockSnapshotPolicy: "REQUIRE_FULL_AVAILABLE_QUANTITY_PER_LINE";
  insufficientStockNeverAutoReduced: true;
};

export type ActivityPickupEligibilitySpecDto = {
  status: "NOT_CONFIGURED";
  requirements: {
    activityStatus: "PUBLISHED";
    participationStatesEligible: readonly ["CONFIRMED"];
    pickupMustNotMutateRsvp: true;
    handoffProofRequired: "OWNER_DECISION";
    leaderDisplayNameTrust: "SERVER_VERIFIED_HOST_ONLY";
  };
  message: string;
};
