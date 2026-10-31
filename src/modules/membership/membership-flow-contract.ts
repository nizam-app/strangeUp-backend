import type { MembershipFlowContractDto } from "./membership.types.js";

/** Versioned read-only contract for Flutter; no purchase side effects. */
export const MEMBERSHIP_FLOW_CONTRACT_VERSION = "2026-10-28-026A" as const;

/**
 * Server-owned membership flow capabilities (Task 026A).
 * Owner decision (2026-10-28): defer all payment and subscription billing until further notice.
 */
export function buildMembershipFlowContract(): MembershipFlowContractDto {
  return {
    contractVersion: MEMBERSHIP_FLOW_CONTRACT_VERSION,
    effectivePlan: {
      source: "SERVER_DEFAULT",
      defaultPlanId: "BASIC",
      trustedClubActivation: false,
      clientPlanClaimsAccepted: false,
    },
    billing: {
      status: "DEFERRED",
      configured: false,
      commercialTermsApproved: false,
      ownerDecision: "DEFER_ALL_PAYMENT_AND_SUBSCRIPTION_BILLING_UNTIL_FURTHER_NOTICE",
      deferredIntegrations: [
        "APPLE_IAP",
        "GOOGLE_PLAY_BILLING",
        "STRIPE",
        "REVENUECAT",
        "SUBSCRIPTION_WEBHOOKS",
        "RECEIPT_VERIFICATION",
        "PAID_ENTITLEMENT_ACTIVATION",
      ],
    },
    checkout: {
      status: "DEFERRED",
      purchasable: false,
      trialStart: "DEFERRED",
      restorePurchases: "DEFERRED",
      paymentMethodCapture: "DEFERRED",
      subscriptionManagement: "DEFERRED",
    },
    billingIntervalSelector: {
      status: "DEFERRED",
      note: "Figma Screen 18 monthly/yearly toggle targets Club offers only. No owner-approved SKUs or prices.",
      intervals: [
        {
          interval: "MONTHLY",
          basic: "AVAILABLE",
          club: "NOT_CONFIGURED",
        },
        {
          interval: "YEARLY",
          basic: "NOT_APPLICABLE",
          club: "NOT_CONFIGURED",
        },
      ],
    },
    figmaEvidence: {
      screen18MembershipPlans: "PARTIAL",
      subscriptionCheckoutHtmlBody: "DEFERRED",
      postPurchaseConfirmation: "NOT_PROVIDED",
      billingManagementScreens: "NOT_PROVIDED",
      knownPricingContradictions: [
        "Screen 18 yearly Club copy ($6.49/mo billed $77.88/yr) conflicts with checkout Html Body ($9.99/mo).",
        "Checkout trial/tax arithmetic ($9.99 + $0.80 - $9.99) is illustrative only — not configured server-side.",
      ],
    },
    domainSeparation: {
      digitalMembershipBilling: "DEFERRED",
      physicalMarketplaceCheckout: "UNAVAILABLE",
      communityGroupMembership: "INDEPENDENT",
      task022KycAdminGate: "INDEPENDENT",
    },
    capabilityStatusLegend: {
      AVAILABLE:
        "Implemented product surface; may still require Task 022 KYC/admin gates per feature.",
      NOT_CONFIGURED:
        "Product/policy or commercial terms not approved (D-08); do not sell or enforce.",
      DEFERRED: "Explicitly deferred engineering (billing, checkout, restore, trials).",
      NOT_IMPLEMENTED: "Approved-in-principle perk without backend enforcement foundation.",
    },
  };
}
