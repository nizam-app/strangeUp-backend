import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { AdminAccountModerationService } from "./admin-account-moderation.service.js";
import {
  adminAccountRestoreBodySchema,
  adminAccountSuspendBodySchema,
} from "./admin-account-moderation.validation.js";
import { AdminUsersService } from "./admin-users.service.js";
import {
  adminUsersListQuerySchema,
  adminUsersSummaryQuerySchema,
  adminUsersUserIdParamsSchema,
} from "./admin-users.validation.js";

const IDEMPOTENCY_HEADER = "idempotency-key";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createAdminUsersController(deps: { db: DatabaseClient }) {
  const service = new AdminUsersService(deps.db);
  const moderation = new AdminAccountModerationService(deps.db);

  return {
    summary: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      adminUsersSummaryQuerySchema.parse(req.query);
      const data = await service.getUsersSummary();
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    list: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const query = adminUsersListQuerySchema.parse(req.query);
      const result = await service.listUsers(query);
      res.status(200).json({
        data: { users: result.users, nextCursor: result.nextCursor },
        meta: { requestId: req.requestId },
      });
    },
    detail: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const actor = requireUser(req);
      const params = adminUsersUserIdParamsSchema.parse(req.params);
      const data = await service.getUserDetail(params.userId, actor.id);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    suspend: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const actor = requireUser(req);
      const params = adminUsersUserIdParamsSchema.parse(req.params);
      const body = adminAccountSuspendBodySchema.parse(req.body ?? {});
      const idempotencyKey = req.header(IDEMPOTENCY_HEADER)?.trim();
      const data = await moderation.suspendAccount({
        actor,
        userId: params.userId,
        reasonCode: body.reasonCode,
        reason: body.reason,
        expectedAccountStatus: body.expectedAccountStatus,
        idempotencyKey,
      });
      req.log?.info(
        {
          event: "admin_account_suspend",
          actorUserId: actor.id,
          targetUserId: params.userId,
          decisionId: data.decisionId,
          reasonCode: data.reasonCode,
          idempotentReplay: data.idempotentReplay,
        },
        "Admin account suspend",
      );
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    restore: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const actor = requireUser(req);
      const params = adminUsersUserIdParamsSchema.parse(req.params);
      const body = adminAccountRestoreBodySchema.parse(req.body ?? {});
      const idempotencyKey = req.header(IDEMPOTENCY_HEADER)?.trim();
      const data = await moderation.restoreAccount({
        actor,
        userId: params.userId,
        reason: body.reason,
        expectedAccountStatus: body.expectedAccountStatus,
        idempotencyKey,
      });
      req.log?.info(
        {
          event: "admin_account_restore",
          actorUserId: actor.id,
          targetUserId: params.userId,
          decisionId: data.decisionId,
          resultingAccountStatus: data.resultingAccountStatus,
          idempotentReplay: data.idempotentReplay,
        },
        "Admin account restore",
      );
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
