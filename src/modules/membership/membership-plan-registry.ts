import type {
  MembershipFeatureDto,
  MembershipPlanId,
  MembershipPlanOfferDto,
  PlanOfferAvailability,
} from "./membership.types.js";

const BASIC_DISPLAY = "Basic Explorer";
const CLUB_DISPLAY = "Strangeup Club";

/** Figma Screen 18 copy is illustrative; not approved commerce or enforcement policy. */
function basicFeatures(): MembershipFeatureDto[] {
  return [
    {
      key: "community_groups_and_chat",
      label: "Community groups and group chat",
      status: "AVAILABLE",
      enforced: false,
    },
    {
      key: "direct_messaging",
      label: "Direct messaging (existing social policy)",
      status: "AVAILABLE",
      enforced: false,
    },
    {
      key: "activity_discovery_and_rsvp",
      label: "Activity discovery and RSVP (Task 010 rules apply)",
      status: "AVAILABLE",
      enforced: false,
    },
    {
      key: "monthly_activity_join_cap",
      label: "Monthly activity join cap (Figma: up to three)",
      status: "NOT_CONFIGURED",
      enforced: false,
      figmaIllustrationOnly: true,
      policyDependency: "D-08-04",
    },
    {
      key: "discovery_radius_limit",
      label: "Discovery radius limit (Figma: five miles)",
      status: "NOT_IMPLEMENTED",
      enforced: false,
      figmaIllustrationOnly: true,
      policyDependency: "D-04/D-08",
    },
    {
      key: "identity_verification_badge",
      label: "ID verification badge on profile",
      status: "NOT_IMPLEMENTED",
      enforced: false,
      figmaIllustrationOnly: true,
      policyDependency: "D-09-provider",
    },
  ];
}

function clubFeatures(): MembershipFeatureDto[] {
  return [
    {
      key: "unlimited_discovery_radius",
      label: "Unlimited discovery / radius",
      status: "NOT_IMPLEMENTED",
      enforced: false,
      requiresPlan: "CLUB",
      policyDependency: "D-08/D-04",
    },
    {
      key: "curated_interests",
      label: "Curated premium interests",
      status: "NOT_IMPLEMENTED",
      enforced: false,
      requiresPlan: "CLUB",
      policyDependency: "D-08",
    },
    {
      key: "private_circles",
      label: "Private circles",
      status: "NOT_IMPLEMENTED",
      enforced: false,
      requiresPlan: "CLUB",
      policyDependency: "D-08",
    },
    {
      key: "radar_boosting",
      label: "Radar / spotlight boosting",
      status: "NOT_IMPLEMENTED",
      enforced: false,
      requiresPlan: "CLUB",
      policyDependency: "D-08",
    },
    {
      key: "vip_perimeter",
      label: "VIP perimeter access",
      status: "NOT_IMPLEMENTED",
      enforced: false,
      requiresPlan: "CLUB",
      policyDependency: "D-08",
    },
    {
      key: "concierge_service",
      label: "Concierge service",
      status: "NOT_IMPLEMENTED",
      enforced: false,
      requiresPlan: "CLUB",
      policyDependency: "D-08",
    },
    {
      key: "subscription_checkout",
      label: "Subscription checkout (Screen 18 → Html Body)",
      status: "DEFERRED",
      enforced: false,
      requiresPlan: "CLUB",
      policyDependency: "D-08-01/D-08-03",
    },
    {
      key: "restore_purchases",
      label: "Restore purchases",
      status: "DEFERRED",
      enforced: false,
      requiresPlan: "CLUB",
      policyDependency: "D-08-05",
    },
    {
      key: "apple_pay_checkout",
      label: "Apple Pay / store billing presentation",
      status: "DEFERRED",
      enforced: false,
      requiresPlan: "CLUB",
      policyDependency: "D-08-01",
    },
  ];
}

function buildPlanOffer(
  planId: MembershipPlanId,
  displayName: string,
  tagline: string,
  availability: PlanOfferAvailability,
  purchasable: boolean,
  features: MembershipFeatureDto[],
): MembershipPlanOfferDto {
  if (planId === "BASIC") {
    return {
      planId,
      displayName,
      tagline,
      availability,
      purchasable,
      pricing: {
        currency: "USD",
        monthlyAmountCents: 0,
        annualAmountCents: null,
        annualMonthlyEquivalentCents: null,
        billingIntervalOptions: ["MONTHLY"],
        configured: true,
      },
      features,
    };
  }

  return {
    planId,
    displayName,
    tagline,
    availability,
    purchasable,
    pricing: null,
    features,
  };
}

export function listMembershipPlanOffers(): MembershipPlanOfferDto[] {
  return [
    buildPlanOffer(
      "BASIC",
      BASIC_DISPLAY,
      "Default free account — full access to implemented product features under existing Task 006–016 rules.",
      "AVAILABLE",
      false,
      basicFeatures(),
    ),
    buildPlanOffer(
      "CLUB",
      CLUB_DISPLAY,
      "Premium tier offer — billing and entitlements not configured (D-08).",
      "NOT_CONFIGURED",
      false,
      clubFeatures(),
    ),
  ];
}

export function planDisplayName(planId: MembershipPlanId): string {
  return planId === "BASIC" ? BASIC_DISPLAY : CLUB_DISPLAY;
}

export const UPGRADE_BLOCKED_REASONS = [
  "OWNER_DEFERRED_ALL_PAYMENT_AND_SUBSCRIPTION_BILLING",
  "D-08_COMMERCIAL_TERMS_NOT_APPROVED",
  "BILLING_PROVIDER_NOT_CONFIGURED",
  "CLUB_ENROLLMENT_NOT_PURCHASABLE",
] as const;
