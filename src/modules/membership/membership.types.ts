export const MEMBERSHIP_PLAN_IDS = ["BASIC", "CLUB"] as const;
export type MembershipPlanId = (typeof MEMBERSHIP_PLAN_IDS)[number];

export type PlanOfferAvailability = "AVAILABLE" | "COMING_SOON" | "NOT_CONFIGURED";

export type EntitlementCapabilityStatus =
  "AVAILABLE" | "UNAVAILABLE" | "NOT_IMPLEMENTED" | "POLICY_PENDING";

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
  notes: {
    identityVerificationIndependent: string;
    kycBadgeNotFromMembership: string;
  };
};

export type SettingsMembershipSummaryDto = {
  planId: MembershipPlanId;
  planDisplayName: string;
  billingStatus: MembershipBillingStatus;
  canUpgrade: boolean;
};
