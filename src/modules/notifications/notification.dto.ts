import type { UserNotificationType } from "../../../generated/prisma/client.js";
import type { PublicProfilePreviewDto } from "../discovery/public-profile.dto.js";

export type NotificationActorDto = PublicProfilePreviewDto | null;

export type NotificationDto = {
  notificationId: string;
  type: UserNotificationType;
  title: string;
  body: string;
  actor: NotificationActorDto;
  sourceId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
};

export type NotificationListDto = {
  notifications: NotificationDto[];
  unreadCount: number;
};
