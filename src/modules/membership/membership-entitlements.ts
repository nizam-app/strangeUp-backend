import { listMembershipPlanOffers, planDisplayName } from "./membership-plan-registry.js";
import type {
  MembershipEntitlementsDto,
  MembershipFeatureDto,
  MembershipPlanId,
  SelfMembershipDto,
  SettingsMembershipSummaryDto,
} from "./membership.types.js";
import { UPGRADE_BLOCKED_REASONS } from "./membership-plan-registry.js";

/**
 * Trusted paid tier resolution. No persisted subscription ledger in Task 017;
 * always BASIC until owner-approved billing webhooks exist.
 */
export function resolveEffectivePlanId(_userId: string): MembershipPlanId {
  return "BASIC";
}

/** Default-deny for premium-only operations until D-08 + verified billing events. */
export function userHasClubEntitlement(userId: string): boolean {
  return resolveEffectivePlanId(userId) === "CLUB";
}

export function entitlementsForPlan(planId: MembershipPlanId): MembershipEntitlementsDto {
  const offer = listMembershipPlanOffers().find((p) => p.planId === planId);
  const capabilities: MembershipFeatureDto[] = offer?.features ?? [];
  return {
    effectivePlanId: planId,
    capabilities,
  };
}

export function buildSelfMembership(userId: string): SelfMembershipDto {
  const planId = resolveEffectivePlanId(userId);
  return {
    planId,
    planDisplayName: planDisplayName(planId),
    tierKind: "FREE",
    billingStatus: "NOT_CONFIGURED",
    canUpgrade: false,
    upgradeBlockedReasons: [...UPGRADE_BLOCKED_REASONS],
    trial: null,
    subscription: null,
    nextBillingAt: null,
    paymentMethod: null,
    entitlements: entitlementsForPlan(planId),
    notes: {
      identityVerificationIndependent:
        "Government ID verification (Task 010 KYC) is independent of membership tier.",
      kycBadgeNotFromMembership:
        "Do not show a verified ID badge based on membership; KYC approval requires a trusted provider.",
    },
  };
}

export function buildSettingsMembershipSummary(userId: string): SettingsMembershipSummaryDto {
  const planId = resolveEffectivePlanId(userId);
  return {
    planId,
    planDisplayName: planDisplayName(planId),
    billingStatus: "NOT_CONFIGURED",
    canUpgrade: false,
  };
}
