import type { DirectMessageRequestStatus } from "../../../generated/prisma/client.js";
import type { PolicyActor } from "../policy/account-policy.js";
import { hasFullAccountAccess } from "../policy/account-policy.js";
import {
  canViewPublicProfile,
  type DiscoverUserSnapshot,
} from "../policy/public-profile-policy.js";
import type { ProfileVisibility } from "../../../generated/prisma/client.js";

export function isSelfTarget(actorId: string, targetId: string): boolean {
  return actorId === targetId;
}

export function canonicalizeParticipantPair(
  userAId: string,
  userBId: string,
): { low: string; high: string } {
  return userAId < userBId ? { low: userAId, high: userBId } : { low: userBId, high: userAId };
}

export function otherParticipantId(lowId: string, highId: string, viewerId: string): string {
  return viewerId === lowId ? highId : lowId;
}

/** New follow / wave / message-request: D-03 visibility + blocks + eligible target. */
export function canInitiateSocialContact(
  viewer: DiscoverUserSnapshot,
  target: DiscoverUserSnapshot,
  targetVisibility: ProfileVisibility,
  blockedEitherDirection: boolean,
): boolean {
  if (isSelfTarget(viewer.userId, target.userId)) {
    return false;
  }
  return canViewPublicProfile(viewer, target, targetVisibility, blockedEitherDirection);
}

/** Accepted conversations keep consent; every read/send still requires eligibility and no block. */
export function canAccessAcceptedConversation(
  actor: PolicyActor,
  blockedEitherDirection: boolean,
): boolean {
  return hasFullAccountAccess(actor) && !blockedEitherDirection;
}

export type MessageRequestCreateDecision = "create" | "return_existing" | "declined";

export function decideMessageRequestCreate(
  existing: DirectMessageRequestStatus | null,
): MessageRequestCreateDecision {
  if (existing === null) {
    return "create";
  }
  if (existing === "DECLINED") {
    return "declined";
  }
  return "return_existing";
}

export type MessageRequestRespondDecision =
  "accept" | "decline" | "already_accepted" | "already_declined" | "forbidden";

export function decideMessageRequestRespond(
  status: DirectMessageRequestStatus,
  isRecipient: boolean,
  action: "accept" | "decline",
): MessageRequestRespondDecision {
  if (!isRecipient) {
    return "forbidden";
  }
  if (action === "accept") {
    if (status === "ACCEPTED") {
      return "already_accepted";
    }
    if (status === "DECLINED") {
      return "already_declined";
    }
    return "accept";
  }
  if (status === "DECLINED") {
    return "already_declined";
  }
  if (status === "ACCEPTED") {
    return "already_accepted";
  }
  return "decline";
}

export function shouldAdvanceReadWatermark(
  current: { createdAt: Date; id: string } | null,
  next: { createdAt: Date; id: string },
): boolean {
  if (!current) {
    return true;
  }
  if (next.createdAt.getTime() > current.createdAt.getTime()) {
    return true;
  }
  if (next.createdAt.getTime() < current.createdAt.getTime()) {
    return false;
  }
  return next.id > current.id;
}

export function isMessageAfterWatermark(
  message: { createdAt: Date; id: string },
  watermark: { createdAt: Date; id: string } | null,
): boolean {
  if (!watermark) {
    return true;
  }
  if (message.createdAt.getTime() > watermark.createdAt.getTime()) {
    return true;
  }
  if (message.createdAt.getTime() < watermark.createdAt.getTime()) {
    return false;
  }
  return message.id > watermark.id;
}

export function truncatePreview(body: string, max: number): string {
  if (body.length <= max) {
    return body;
  }
  return body.slice(0, max);
}
