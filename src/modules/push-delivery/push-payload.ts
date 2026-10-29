import type { UserNotificationType } from "../../../generated/prisma/client.js";

/** Privacy-safe FCM data payload — no message bodies, KYC, or tokens. */
export type PushDataPayload = {
  notificationId: string;
  type: UserNotificationType;
  sourceId?: string;
};

export type PushDisplayCopy = {
  title: string;
  body: string;
};

const GENERIC_COPY: Record<UserNotificationType, PushDisplayCopy> = {
  MESSAGE_REQUEST_RECEIVED: {
    title: "Message request",
    body: "Open StrangeUp to respond",
  },
  MESSAGE_REQUEST_ACCEPTED: {
    title: "Request accepted",
    body: "Open StrangeUp to continue the conversation",
  },
  DIRECT_MESSAGE_RECEIVED: {
    title: "New message",
    body: "Open StrangeUp to read",
  },
  GROUP_MEMBERSHIP_APPROVED: {
    title: "Group update",
    body: "Open StrangeUp for details",
  },
  GROUP_MEMBERSHIP_DECLINED: {
    title: "Group update",
    body: "Open StrangeUp for details",
  },
  ACTIVITY_RSVP_CONFIRMED: {
    title: "Activity update",
    body: "Open StrangeUp for details",
  },
  ACTIVITY_RSVP_WAITLISTED: {
    title: "Activity update",
    body: "Open StrangeUp for details",
  },
  ACTIVITY_WAITLIST_PROMOTED: {
    title: "Activity update",
    body: "Open StrangeUp for details",
  },
  ACTIVITY_JOIN_REQUEST_RECEIVED: {
    title: "Activity join request",
    body: "Open StrangeUp to review",
  },
  ACTIVITY_JOIN_REQUEST_APPROVED: {
    title: "Activity update",
    body: "Open StrangeUp for details",
  },
  ACTIVITY_JOIN_REQUEST_DECLINED: {
    title: "Activity update",
    body: "Open StrangeUp for details",
  },
  MEETUP_INVITATION_RECEIVED: {
    title: "Meetup invitation",
    body: "Open StrangeUp for details",
  },
  MEETUP_INVITATION_ACCEPTED: {
    title: "Meetup invitation accepted",
    body: "Open StrangeUp for details",
  },
  MEETUP_INVITATION_DECLINED: {
    title: "Meetup invitation declined",
    body: "Open StrangeUp for details",
  },
  MEETUP_INVITATION_WITHDRAWN: {
    title: "Meetup invitation withdrawn",
    body: "Open StrangeUp for details",
  },
};

export function buildPrivacySafePushPayload(input: {
  notificationId: string;
  type: UserNotificationType;
  sourceId?: string | null;
}): { data: Record<string, string>; notification: PushDisplayCopy } {
  const copy = GENERIC_COPY[input.type];
  const data: Record<string, string> = {
    notificationId: input.notificationId,
    type: input.type,
  };
  if (input.sourceId) {
    data.sourceId = input.sourceId;
  }
  return { data, notification: copy };
}
