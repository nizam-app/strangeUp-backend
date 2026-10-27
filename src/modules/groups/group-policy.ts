import type {
  CommunityGroupPrivacy,
  CommunityGroupStatus,
  CommunityMembershipRole,
  CommunityMembershipStatus,
} from "../../../generated/prisma/client.js";
import type { PolicyActor } from "../policy/account-policy.js";
import { hasFullAccountAccess } from "../policy/account-policy.js";

export function canUseGroups(actor: PolicyActor): boolean {
  return hasFullAccountAccess(actor);
}

export function isDiscoverableGroupStatus(status: CommunityGroupStatus): boolean {
  return status === "ACTIVE";
}

export function isOpenForNewJoins(status: CommunityGroupStatus): boolean {
  return status === "ACTIVE";
}

export function canAccessGroupContent(input: {
  groupStatus: CommunityGroupStatus;
  membershipStatus: CommunityMembershipStatus | null;
}): boolean {
  return input.membershipStatus === "ACTIVE";
}

export function canSeePrivateGroupInternals(input: {
  privacy: CommunityGroupPrivacy;
  membershipStatus: CommunityMembershipStatus | null;
}): boolean {
  if (input.privacy === "PUBLIC") {
    return input.membershipStatus === "ACTIVE";
  }
  return input.membershipStatus === "ACTIVE";
}

export function canNonMemberSeeCover(input: {
  privacy: CommunityGroupPrivacy;
  status: CommunityGroupStatus;
}): boolean {
  return input.privacy === "PUBLIC" && input.status === "ACTIVE";
}

export function isManagerRole(role: CommunityMembershipRole | null): boolean {
  return role === "OWNER" || role === "MODERATOR";
}

export function canApproveMembership(role: CommunityMembershipRole | null): boolean {
  return isManagerRole(role);
}

export function canRemoveMember(
  actorRole: CommunityMembershipRole,
  targetRole: CommunityMembershipRole,
): boolean {
  if (targetRole === "OWNER") {
    return false;
  }
  if (actorRole === "OWNER") {
    return targetRole === "MODERATOR" || targetRole === "MEMBER";
  }
  if (actorRole === "MODERATOR") {
    return targetRole === "MEMBER";
  }
  return false;
}

export function canChangeMemberRole(actorRole: CommunityMembershipRole): boolean {
  return actorRole === "OWNER";
}

export function canEditCoreGroupFields(role: CommunityMembershipRole | null): boolean {
  return isManagerRole(role);
}

export function canEditRestrictedGroupFields(role: CommunityMembershipRole | null): boolean {
  return role === "OWNER";
}

export function canArchiveGroup(role: CommunityMembershipRole | null): boolean {
  return role === "OWNER";
}

export function canTransferOwnership(role: CommunityMembershipRole | null): boolean {
  return role === "OWNER";
}

export function canPinOrModerateContent(role: CommunityMembershipRole | null): boolean {
  return isManagerRole(role);
}

export function canDecreaseMemberCapacity(nextCapacity: number, activeCount: number): boolean {
  return nextCapacity >= activeCount;
}

export function hasOpenMemberSeat(activeCount: number, capacity: number | null): boolean {
  if (capacity === null) {
    return true;
  }
  return activeCount < capacity;
}

export type GroupJoinDecision =
  | "already_active"
  | "already_pending"
  | "join_immediate"
  | "request_pending"
  | "moderated_reapply"
  | "full"
  | "closed";

export function decideGroupJoin(input: {
  groupStatus: CommunityGroupStatus;
  privacy: CommunityGroupPrivacy;
  existingStatus: CommunityMembershipStatus | null;
  hasOpenSeat: boolean;
}): GroupJoinDecision {
  if (!isOpenForNewJoins(input.groupStatus)) {
    return "closed";
  }
  if (input.existingStatus === "ACTIVE") {
    return "already_active";
  }
  if (input.existingStatus === "PENDING") {
    return "already_pending";
  }
  if (input.existingStatus === "DECLINED" || input.existingStatus === "REMOVED") {
    if (!input.hasOpenSeat) {
      return "full";
    }
    return "moderated_reapply";
  }
  if (!input.hasOpenSeat) {
    return "full";
  }
  if (input.privacy === "PUBLIC") {
    return "join_immediate";
  }
  return "request_pending";
}

export type GroupLeaveDecision =
  "leave_active" | "cancel_pending" | "already_left" | "owner_blocked";

export function decideGroupLeave(input: {
  existingStatus: CommunityMembershipStatus | null;
  role: CommunityMembershipRole | null;
}): GroupLeaveDecision {
  if (input.role === "OWNER" && input.existingStatus === "ACTIVE") {
    return "owner_blocked";
  }
  if (input.existingStatus === "ACTIVE") {
    return "leave_active";
  }
  if (input.existingStatus === "PENDING") {
    return "cancel_pending";
  }
  return "already_left";
}

export function decideApproveRequest(input: {
  status: CommunityMembershipStatus;
  hasOpenSeat: boolean;
  groupStatus: CommunityGroupStatus;
}): "approve" | "already_active" | "not_pending" | "full" | "closed" {
  if (!isOpenForNewJoins(input.groupStatus)) {
    return "closed";
  }
  if (input.status === "ACTIVE") {
    return "already_active";
  }
  if (input.status !== "PENDING") {
    return "not_pending";
  }
  if (!input.hasOpenSeat) {
    return "full";
  }
  return "approve";
}

export function decideDeclineRequest(
  status: CommunityMembershipStatus,
): "decline" | "already_declined" | "not_pending" {
  if (status === "DECLINED") {
    return "already_declined";
  }
  if (status !== "PENDING") {
    return "not_pending";
  }
  return "decline";
}

export function normalizeGroupTag(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidGroupTag(tag: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,22}[a-z0-9]$/.test(tag) || /^[a-z0-9]{2,24}$/.test(tag);
}
