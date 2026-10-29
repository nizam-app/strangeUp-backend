import type { MembershipPlanId } from "../membership/membership.types.js";

/**
 * Canonical merchandise pricing model (Task 024C).
 * Catalog `priceCents` is always the list/base unit price.
 * When membership merch benefits are enabled (post D-08), at most ONE membership adjustment
 * is applied at quote time — never both reduced line unit prices and a separate cart discount.
 */
export type StorePricingModel = "LIST_PRICE_PLUS_SINGLE_CART_DISCOUNT";

export type StorePricingComponentStatus = "NOT_CONFIGURED" | "APPLIED";

export type StoreUnitPricingDto = {
  model: StorePricingModel;
  listUnitPriceCents: number;
  compareAtUnitPriceCents: number | null;
  currency: string;
  /** Reserved for alternate model (explicit member line price) — null while canonical model is active. */
  memberUnitPriceCents: null;
  membershipAdjustment: {
    status: "NOT_CONFIGURED";
    reasonCode: "MEMBERSHIP_MERCH_DISCOUNT_PENDING_D08";
    message: string;
  };
  presentation: "LIST_AND_COMPARE_AT_ONLY";
};

export type StoreProductPricingHintDto = {
  model: StorePricingModel;
  membershipPriceStatus: "NOT_CONFIGURED";
  reasonCode: "MEMBERSHIP_MERCH_DISCOUNT_PENDING_D08";
};

export type StoreCartPricingQuoteDto = {
  model: StorePricingModel;
  antiDoubleDiscountPolicy: string;
  viewer: {
    effectivePlanId: MembershipPlanId;
    /** True only when trusted billing grants CLUB — still does not imply a live discount amount. */
    clubMerchandiseBenefitEligible: boolean;
    clubBenefitIneligibleReasonCode: "CLUB_NOT_PURCHASABLE" | "NOT_CLUB_MEMBER" | null;
  };
  catalogSubtotalCents: number;
  currency: string | null;
  membershipDiscount: {
    status: StorePricingComponentStatus;
    reasonCode: "MEMBERSHIP_MERCH_DISCOUNT_PENDING_D08";
    message: string;
    discountCents: null;
    percentBasisPoints: null;
  };
  shipping: {
    status: StorePricingComponentStatus;
    reasonCode: "FULFILLMENT_NOT_CONFIGURED";
    message: string;
    amountCents: null;
  };
  tax: {
    status: StorePricingComponentStatus;
    reasonCode: "TAX_POLICY_NOT_CONFIGURED";
    message: string;
    amountCents: null;
  };
  totalDueCents: null;
};

export type StoreMerchandisePricingPolicyDto = {
  model: StorePricingModel;
  antiDoubleDiscountPolicy: string;
  listPriceAuthority: "SERVER_CATALOG_VARIANT_PRICE_CENTS";
  membershipDiscount: {
    status: "NOT_CONFIGURED";
    reasonCode: "MEMBERSHIP_MERCH_DISCOUNT_PENDING_D08";
    ownerDecisions: string[];
  };
  shippingAndTax: {
    status: "NOT_CONFIGURED";
    reasonCode: "MKT_03_FULFILLMENT_AND_TAX_OPEN";
  };
  checkout: {
    status: "UNAVAILABLE";
    reasonCode: "PAYMENT_AND_FULFILLMENT_NOT_CONFIGURED";
  };
};
