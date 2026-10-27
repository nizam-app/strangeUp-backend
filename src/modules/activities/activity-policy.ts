import type {
  ActivityAudience,
  ActivityMode,
  ActivityParticipationState,
  ActivityStatus,
} from "../../../generated/prisma/client.js";
import type { PolicyActor } from "../policy/account-policy.js";
import { hasFullAccountAccess } from "../policy/account-policy.js";
import {
  hasCurrentTrustedKycForEnforcement,
  type ActivityKycEnforcementContext,
  type KycTrustSnapshot,
} from "./activity-kyc.js";

export function isRealWorldActivityMode(mode: ActivityMode): boolean {
  return mode === "IN_PERSON" || mode === "HYBRID";
}

export function canBrowseActivities(actor: PolicyActor): boolean {
  return hasFullAccountAccess(actor);
}

export function canManageOwnActivities(actor: PolicyActor): boolean {
  return hasFullAccountAccess(actor);
}

export function canPublishAudience(audience: ActivityAudience): boolean {
  return audience === "PUBLIC";
}

export function isDiscoverableStatus(status: ActivityStatus): boolean {
  return status === "PUBLISHED";
}

export function isJoinableStatus(status: ActivityStatus): boolean {
  return status === "PUBLISHED";
}

export function isUpcomingInstant(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() > now.getTime();
}

export function requiresKycForPublish(mode: ActivityMode): boolean {
  return isRealWorldActivityMode(mode);
}

export function requiresKycForConfirmedJoin(mode: ActivityMode): boolean {
  return isRealWorldActivityMode(mode);
}

export function canChangePublishedSchedule(participantCount: number): boolean {
  return participantCount === 0;
}

export function canDecreaseCapacity(nextCapacity: number, confirmedCount: number): boolean {
  return nextCapacity >= confirmedCount;
}

export function hasTrustedKycForActivityAction(
  kycTrust: KycTrustSnapshot,
  ctx: ActivityKycEnforcementContext,
): boolean {
  return hasCurrentTrustedKycForEnforcement(kycTrust, ctx);
}

export type WaitlistPromotionDecision =
  | { action: "promote" }
  | { action: "hold_queue"; reason: "kyc" | "ineligible" | "blocked" }
  | { action: "none" };

/**
 * FIFO waitlist: only the head of queue is considered.
 * Ineligible heads are not skipped (no owner-approved skip/bypass policy).
 */
export function decideWaitlistPromotion(input: {
  hasOpenSeat: boolean;
  nextQueued: {
    accountEligible: boolean;
    blockedWithHost: boolean;
    kycTrust: KycTrustSnapshot;
  } | null;
  mode: ActivityMode;
  kyc: ActivityKycEnforcementContext;
}): WaitlistPromotionDecision {
  if (!input.hasOpenSeat || !input.nextQueued) {
    return { action: "none" };
  }
  if (input.nextQueued.blockedWithHost) {
    return { action: "hold_queue", reason: "blocked" };
  }
  if (!input.nextQueued.accountEligible) {
    return { action: "hold_queue", reason: "ineligible" };
  }
  if (
    requiresKycForConfirmedJoin(input.mode) &&
    !hasTrustedKycForActivityAction(input.nextQueued.kycTrust, input.kyc)
  ) {
    return { action: "hold_queue", reason: "kyc" };
  }
  return { action: "promote" };
}

export function canAccessMeetingDetails(input: {
  isHost: boolean;
  participationState: ActivityParticipationState | null;
  activityStatus: ActivityStatus;
  mode: ActivityMode;
  kycTrust: KycTrustSnapshot;
  accountEligible: boolean;
  blockedWithHost: boolean;
  kyc: ActivityKycEnforcementContext;
}): boolean {
  if (input.blockedWithHost && !input.isHost) {
    return false;
  }
  if (!input.accountEligible) {
    return false;
  }
  if (input.activityStatus === "CANCELLED") {
    return input.isHost;
  }
  if (input.isHost) {
    return true;
  }
  if (input.participationState !== "CONFIRMED") {
    return false;
  }
  if (
    requiresKycForConfirmedJoin(input.mode) &&
    !hasTrustedKycForActivityAction(input.kycTrust, input.kyc)
  ) {
    return false;
  }
  return true;
}

export function resolveJoinPath(input: {
  isHost: boolean;
  status: ActivityStatus;
  upcoming: boolean;
  confirmedCount: number;
  capacity: number;
  waitlistEnabled: boolean;
  existingState: ActivityParticipationState | null;
  mode: ActivityMode;
  kycTrust: KycTrustSnapshot;
  kyc: ActivityKycEnforcementContext;
}): "already_joined" | "confirm" | "waitlist" | "kyc_required" | "full" | "closed" | "host" {
  if (input.isHost) {
    return "host";
  }
  if (input.existingState === "CONFIRMED" || input.existingState === "WAITLISTED") {
    return "already_joined";
  }
  if (!isJoinableStatus(input.status) || !input.upcoming) {
    return "closed";
  }
  if (input.confirmedCount < input.capacity) {
    if (
      requiresKycForConfirmedJoin(input.mode) &&
      !hasTrustedKycForActivityAction(input.kycTrust, input.kyc)
    ) {
      return "kyc_required";
    }
    return "confirm";
  }
  if (input.waitlistEnabled) {
    return "waitlist";
  }
  return "full";
}
