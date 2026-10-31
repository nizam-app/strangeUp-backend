import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { AdminDashboardService } from "./admin-dashboard.service.js";
import {
  adminDashboardCategoriesQuerySchema,
  adminDashboardEventsQuerySchema,
  adminDashboardExportQuerySchema,
  adminDashboardQueueQuerySchema,
  adminDashboardRangeQuerySchema,
} from "./admin-dashboard.validation.js";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createAdminDashboardController(deps: { db: DatabaseClient; env: AppEnv }) {
  const service = new AdminDashboardService(deps.db, deps.env);

  return {
    overview: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = adminDashboardRangeQuerySchema.parse(req.query);
      const data = await service.getOverview(query.range);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    growth: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = adminDashboardRangeQuerySchema.parse(req.query);
      const data = await service.getGrowth(query.range);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    activityCategories: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = adminDashboardCategoriesQuerySchema.parse(req.query);
      const data = await service.getActivityCategories(query.range, query.limit);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    verificationQueue: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = adminDashboardQueueQuerySchema.parse(req.query);
      const data = await service.getVerificationQueue(query.limit);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    recentEvents: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = adminDashboardEventsQuerySchema.parse(req.query);
      const data = await service.getRecentEvents(query);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    exportCsv: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const reviewer = requireUser(req);
      const query = adminDashboardExportQuerySchema.parse(req.query);
      const result = await service.exportOverviewCsv(query.range);
      req.log?.info(
        {
          event: "admin_dashboard_csv_export",
          reviewerUserId: reviewer.id,
          range: query.range,
          rowCount: result.rowCount,
        },
        "Admin dashboard CSV export",
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename.replace(/"/g, "")}"`,
      );
      res.setHeader("X-Admin-Dashboard-Export-Row-Count", String(result.rowCount));
      res.status(200).send(result.csv);
    },
  };
}
