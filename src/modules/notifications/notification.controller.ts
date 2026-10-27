import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { NotificationService } from "./notification.service.js";
import {
  notificationIdParamSchema,
  notificationListQuerySchema,
} from "./notification.validation.js";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createNotificationController(deps: { db: DatabaseClient }) {
  const service = new NotificationService(deps.db);

  return {
    list: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = notificationListQuerySchema.parse(req.query);
      const result = await service.list(requireUser(req), query);
      res.status(200).json({
        data: { notifications: result.notifications, unreadCount: result.unreadCount },
        meta: { requestId: req.requestId, nextCursor: result.nextCursor },
      });
    },

    markRead: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { notificationId } = notificationIdParamSchema.parse(req.params);
      const data = await service.markRead(requireUser(req), notificationId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    markAllRead: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await service.markAllRead(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
