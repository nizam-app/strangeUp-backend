import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { ActivityCoverStorage } from "../activities/activity-cover.storage.js";
import { AdminActivityCancellationService } from "./admin-activity-cancellation.service.js";
import { adminActivityCancelBodySchema } from "./admin-activity-cancellation.validation.js";
import { AdminActivitiesService } from "./admin-activities.service.js";
import {
  adminActivitiesActivityIdParamsSchema,
  adminActivitiesExportQuerySchema,
  adminActivitiesListQuerySchema,
  adminActivitiesSummaryQuerySchema,
} from "./admin-activities.validation.js";

const IDEMPOTENCY_HEADER = "idempotency-key";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createAdminActivitiesController(deps: {
  db: DatabaseClient;
  activityCoverStorage?: ActivityCoverStorage;
}) {
  const service = new AdminActivitiesService(deps.db, deps.activityCoverStorage);
  const cancellation = new AdminActivityCancellationService(deps.db);

  return {
    summary: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      adminActivitiesSummaryQuerySchema.parse(req.query);
      const data = await service.getActivitiesSummary();
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    list: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = adminActivitiesListQuerySchema.parse(req.query);
      const result = await service.listActivities(query);
      res.status(200).json({
        data: {
          activities: result.activities,
          nextCursor: result.nextCursor,
          totalMatching: result.totalMatching,
        },
        meta: { requestId: req.requestId },
      });
    },
    exportCsv: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const reviewer = requireUser(req);
      const query = adminActivitiesExportQuerySchema.parse(req.query);
      const result = await service.exportActivitiesCsv(query);
      req.log?.info(
        {
          event: "admin_activities_csv_export",
          reviewerUserId: reviewer?.id,
          filterFingerprint: result.filterFingerprint,
          rowCount: result.rowCount,
          truncated: result.truncated,
        },
        "Admin activities CSV export",
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename.replace(/"/g, "")}"`,
      );
      res.setHeader("X-Admin-Activities-Export-Row-Count", String(result.rowCount));
      res.setHeader("X-Admin-Activities-Export-Truncated", result.truncated ? "true" : "false");
      res.setHeader("X-Admin-Activities-Export-Max-Rows", String(result.maxRows));
      res.status(200).send(result.csv);
    },
    detail: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const actor = requireUser(req);
      const params = adminActivitiesActivityIdParamsSchema.parse(req.params);
      const data = await service.getActivityDetail(params.activityId, actor.id);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    cancel: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const actor = requireUser(req);
      const params = adminActivitiesActivityIdParamsSchema.parse(req.params);
      const body = adminActivityCancelBodySchema.parse(req.body ?? {});
      const idempotencyKey = req.header(IDEMPOTENCY_HEADER)?.trim();
      const data = await cancellation.cancelActivity({
        actor,
        activityId: params.activityId,
        reasonCode: body.reasonCode,
        reason: body.reason,
        expectedStatus: body.expectedStatus,
        idempotencyKey,
      });
      req.log?.info(
        {
          event: "admin_activity_cancel",
          actorUserId: actor.id,
          activityId: params.activityId,
          decisionId: data.decisionId,
          reasonCode: data.reasonCode,
          previousActivityStatus: data.previousActivityStatus,
          confirmedClosedCount: data.confirmedClosedCount,
          waitlistedClosedCount: data.waitlistedClosedCount,
          pendingClosedCount: data.pendingClosedCount,
          notificationsSent: data.notificationsSent,
          refundsIssued: data.refundsIssued,
          participantRecordsDeleted: data.participantRecordsDeleted,
          idempotentReplay: data.idempotentReplay,
        },
        "Admin activity cancel",
      );
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    cover: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const params = adminActivitiesActivityIdParamsSchema.parse(req.params);
      const { buffer, contentType } = await service.getCoverBytes(params.activityId);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).send(buffer);
    },
  };
}
