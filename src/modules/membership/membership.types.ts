export const MEMBERSHIP_PLAN_IDS = ["BASIC", "CLUB"] as const;
export type MembershipPlanId = (typeof MEMBERSHIP_PLAN_IDS)[number];

export type PlanOfferAvailability = "AVAILABLE" | "COMING_SOON" | "NOT_CONFIGURED";

export type EntitlementCapabilityStatus =
  | "AVAILABLE"
  | "NOT_CONFIGURED"
  | "DEFERRED"
  | "NOT_IMPLEMENTED";

export type MembershipFlowDeferredStatus = "DEFERRED" | "NOT_CONFIGURED" | "UNAVAILABLE";

export type MembershipFlowContractDto = {
  contractVersion: string;
  effectivePlan: {
    source: "SERVER_DEFAULT";
    defaultPlanId: MembershipPlanId;
    trustedClubActivation: false;
    clientPlanClaimsAccepted: false;
  };
  billing: {
    status: "DEFERRED";
    configured: false;
    commercialTermsApproved: false;
    ownerDecision: "DEFER_ALL_PAYMENT_AND_SUBSCRIPTION_BILLING_UNTIL_FURTHER_NOTICE";
    deferredIntegrations: string[];
  };
  checkout: {
    status: "DEFERRED";
    purchasable: false;
    trialStart: MembershipFlowDeferredStatus;
    restorePurchases: MembershipFlowDeferredStatus;
    paymentMethodCapture: MembershipFlowDeferredStatus;
    subscriptionManagement: MembershipFlowDeferredStatus;
  };
  billingIntervalSelector: {
    status: "DEFERRED";
    note: string;
    intervals: Array<{
      interval: "MONTHLY" | "YEARLY";
      basic: "AVAILABLE" | "NOT_APPLICABLE" | "NOT_CONFIGURED";
      club: "NOT_CONFIGURED";
    }>;
  };
  figmaEvidence: {
    screen18MembershipPlans: "PARTIAL";
    subscriptionCheckoutHtmlBody: "DEFERRED";
    postPurchaseConfirmation: "NOT_PROVIDED";
    billingManagementScreens: "NOT_PROVIDED";
    knownPricingContradictions: string[];
  };
  domainSeparation: {
    digitalMembershipBilling: "DEFERRED";
    physicalMarketplaceCheckout: "UNAVAILABLE";
    communityGroupMembership: "INDEPENDENT";
    task022KycAdminGate: "INDEPENDENT";
  };
  capabilityStatusLegend: Record<EntitlementCapabilityStatus, string>;
};

export type MembershipPlansEnvelopeDto = {
  plans: MembershipPlanOfferDto[];
  billingConfigured: false;
  commercialTermsApproved: false;
  flow: MembershipFlowContractDto;
};

export type MembershipBillingStatus = "NOT_CONFIGURED";

export type MembershipTierKind = "FREE";

export type MembershipPricingDto = {
  currency: "USD";
  monthlyAmountCents: number | null;
  annualAmountCents: number | null;
  annualMonthlyEquivalentCents: number | null;
  billingIntervalOptions: ("MONTHLY" | "YEARLY")[];
  configured: boolean;
};

export type MembershipFeatureDto = {
  key: string;
  label: string;
  status: EntitlementCapabilityStatus;
  /** When false, backend does not enforce plan-based limits for this key. */
  enforced: boolean;
  figmaIllustrationOnly?: boolean;
  requiresPlan?: MembershipPlanId;
  policyDependency?: string;
};

export type MembershipPlanOfferDto = {
  planId: MembershipPlanId;
  displayName: string;
  tagline: string;
  availability: PlanOfferAvailability;
  purchasable: boolean;
  pricing: MembershipPricingDto | null;
  features: MembershipFeatureDto[];
};

export type MembershipEntitlementsDto = {
  effectivePlanId: MembershipPlanId;
  capabilities: MembershipFeatureDto[];
};

export type SelfMembershipDto = {
  planId: MembershipPlanId;
  planDisplayName: string;
  tierKind: MembershipTierKind;
  billingStatus: MembershipBillingStatus;
  canUpgrade: boolean;
  upgradeBlockedReasons: string[];
  trial: null;
  subscription: null;
  nextBillingAt: null;
  paymentMethod: null;
  entitlements: MembershipEntitlementsDto;
  flow: MembershipFlowContractDto;
  notes: {
    identityVerificationIndependent: string;
    kycBadgeNotFromMembership: string;
    communityGroupMembershipIndependent: string;
  };
};

export type SettingsMembershipSummaryDto = {
  planId: MembershipPlanId;
  planDisplayName: string;
  billingStatus: MembershipBillingStatus;
  canUpgrade: boolean;
};
