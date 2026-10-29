import type { PersonalMeetupInviteStatus, PersonalMeetupInviteType } from "../../../generated/prisma/client.js";
import type { MeetupInviteVenueView } from "./meetup-invite.types.js";

export type MeetupInviteCounterpartyDto = {
  userId: string;
  displayName: string | null;
  username: string | null;
};

export type MeetupInviteActionsDto = {
  canAccept: boolean;
  canDecline: boolean;
  canWithdraw: boolean;
};

export type MeetupInviteListItemDto = {
  id: string;
  status: PersonalMeetupInviteStatus;
  meetupType: PersonalMeetupInviteType;
  title: string;
  scheduledStartsAt: string;
  scheduleTimeZone: string;
  venue: MeetupInviteVenueView;
  counterparty: MeetupInviteCounterpartyDto;
  viewerRole: "sender" | "recipient";
  createdAt: string;
  actions: MeetupInviteActionsDto;
};

export type MeetupInviteDetailDto = MeetupInviteListItemDto & {
  note: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  withdrawnAt: string | null;
  expiredAt: string | null;
};

export type MeetupInviteListResponseDto = {
  invites: MeetupInviteListItemDto[];
  nextCursor: string | null;
  counts: {
    pending: number;
  };
};
