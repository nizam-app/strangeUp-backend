import {
  resolveEffectivePlanId,
  userHasClubEntitlement,
} from "../membership/membership-entitlements.js";
import {
  STORE_ANTI_DOUBLE_DISCOUNT_POLICY,
  STORE_MEMBERSHIP_DISCOUNT_NOT_CONFIGURED,
  STORE_PRICING_MODEL,
  STORE_PRICING_OWNER_DECISIONS,
  STORE_SHIPPING_NOT_CONFIGURED,
  STORE_TAX_NOT_CONFIGURED,
} from "./store-pricing.constants.js";
import type {
  StoreCartPricingQuoteDto,
  StoreMerchandisePricingPolicyDto,
  StoreProductPricingHintDto,
  StoreUnitPricingDto,
} from "./store-pricing.types.js";

export function buildStoreMerchandisePricingPolicy(): StoreMerchandisePricingPolicyDto {
  return {
    model: STORE_PRICING_MODEL,
    antiDoubleDiscountPolicy: STORE_ANTI_DOUBLE_DISCOUNT_POLICY,
    listPriceAuthority: "SERVER_CATALOG_VARIANT_PRICE_CENTS",
    membershipDiscount: {
      status: "NOT_CONFIGURED",
      reasonCode: STORE_MEMBERSHIP_DISCOUNT_NOT_CONFIGURED.reasonCode,
      ownerDecisions: [...STORE_PRICING_OWNER_DECISIONS],
    },
    shippingAndTax: {
      status: "NOT_CONFIGURED",
      reasonCode: "MKT_03_FULFILLMENT_AND_TAX_OPEN",
    },
    checkout: {
      status: "UNAVAILABLE" as const,
      reasonCode: "PAYMENT_AND_FULFILLMENT_NOT_CONFIGURED" as const,
    },
  };
}

export function buildStoreProductPricingHint(): StoreProductPricingHintDto {
  return {
    model: STORE_PRICING_MODEL,
    membershipPriceStatus: "NOT_CONFIGURED",
    reasonCode: STORE_MEMBERSHIP_DISCOUNT_NOT_CONFIGURED.reasonCode,
  };
}

export function buildStoreUnitPricing(input: {
  listUnitPriceCents: number;
  compareAtUnitPriceCents: number | null;
  currency: string;
}): StoreUnitPricingDto {
  return {
    model: STORE_PRICING_MODEL,
    listUnitPriceCents: input.listUnitPriceCents,
    compareAtUnitPriceCents: input.compareAtUnitPriceCents,
    currency: input.currency,
    memberUnitPriceCents: null,
    membershipAdjustment: {
      status: "NOT_CONFIGURED",
      reasonCode: STORE_MEMBERSHIP_DISCOUNT_NOT_CONFIGURED.reasonCode,
      message: STORE_MEMBERSHIP_DISCOUNT_NOT_CONFIGURED.message,
    },
    presentation: "LIST_AND_COMPARE_AT_ONLY",
  };
}

function resolveClubBenefitEligibility(userId: string): StoreCartPricingQuoteDto["viewer"] {
  const effectivePlanId = resolveEffectivePlanId(userId);
  const hasClub = userHasClubEntitlement(userId);
  return {
    effectivePlanId,
    clubMerchandiseBenefitEligible: hasClub,
    clubBenefitIneligibleReasonCode: hasClub
      ? null
      : effectivePlanId === "BASIC"
        ? "CLUB_NOT_PURCHASABLE"
        : "NOT_CLUB_MEMBER",
  };
}

export function buildStoreCartPricingQuote(input: {
  userId: string;
  catalogSubtotalCents: number;
  currency: string | null;
}): StoreCartPricingQuoteDto {
  return {
    model: STORE_PRICING_MODEL,
    antiDoubleDiscountPolicy: STORE_ANTI_DOUBLE_DISCOUNT_POLICY,
    viewer: resolveClubBenefitEligibility(input.userId),
    catalogSubtotalCents: input.catalogSubtotalCents,
    currency: input.currency,
    membershipDiscount: {
      ...STORE_MEMBERSHIP_DISCOUNT_NOT_CONFIGURED,
      discountCents: null,
      percentBasisPoints: null,
    },
    shipping: {
      ...STORE_SHIPPING_NOT_CONFIGURED,
      amountCents: null,
    },
    tax: {
      ...STORE_TAX_NOT_CONFIGURED,
      amountCents: null,
    },
    totalDueCents: null,
  };
}
