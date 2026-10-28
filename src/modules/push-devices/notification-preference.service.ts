import type { User } from "../../../generated/prisma/client.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { assertFullAccess } from "../social/social-access.js";
import type { patchNotificationPreferenceBodySchema } from "./notification-preference.validation.js";
import type { z } from "zod";

export type NotificationPreferenceDto = {
  pushEnabled: boolean;
  directMessagesEnabled: boolean;
  messageRequestsEnabled: boolean;
  groupMembershipEnabled: boolean;
  groupChatEnabled: boolean;
  activityUpdatesEnabled: boolean;
  marketingEnabled: boolean;
  deliveryStatus: "PUSH_DISABLED" | "PUSH_ENABLED";
  updatedAt: string;
};

const defaultPreference = {
  pushEnabled: true,
  directMessagesEnabled: true,
  messageRequestsEnabled: true,
  groupMembershipEnabled: true,
  groupChatEnabled: false,
  activityUpdatesEnabled: true,
  marketingEnabled: false,
};

export class NotificationPreferenceService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly env: AppEnv,
  ) {}

  private deliveryStatus(): NotificationPreferenceDto["deliveryStatus"] {
    return this.env.PUSH_ENABLED ? "PUSH_ENABLED" : "PUSH_DISABLED";
  }

  async get(viewer: User): Promise<NotificationPreferenceDto> {
    assertFullAccess(viewer);
    const row = await this.db.userNotificationPreference.findUnique({
      where: { userId: viewer.id },
    });
    if (!row) {
      return {
        ...defaultPreference,
        deliveryStatus: this.deliveryStatus(),
        updatedAt: viewer.updatedAt.toISOString(),
      };
    }
    return {
      pushEnabled: row.pushEnabled,
      directMessagesEnabled: row.directMessagesEnabled,
      messageRequestsEnabled: row.messageRequestsEnabled,
      groupMembershipEnabled: row.groupMembershipEnabled,
      groupChatEnabled: row.groupChatEnabled,
      activityUpdatesEnabled: row.activityUpdatesEnabled,
      marketingEnabled: row.marketingEnabled,
      deliveryStatus: this.deliveryStatus(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async patch(
    viewer: User,
    input: z.infer<typeof patchNotificationPreferenceBodySchema>,
  ): Promise<NotificationPreferenceDto> {
    assertFullAccess(viewer);
    const row = await this.db.userNotificationPreference.upsert({
      where: { userId: viewer.id },
      create: {
        userId: viewer.id,
        ...defaultPreference,
        ...input,
      },
      update: input,
    });
    return {
      pushEnabled: row.pushEnabled,
      directMessagesEnabled: row.directMessagesEnabled,
      messageRequestsEnabled: row.messageRequestsEnabled,
      groupMembershipEnabled: row.groupMembershipEnabled,
      groupChatEnabled: row.groupChatEnabled,
      activityUpdatesEnabled: row.activityUpdatesEnabled,
      marketingEnabled: row.marketingEnabled,
      deliveryStatus: this.deliveryStatus(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
