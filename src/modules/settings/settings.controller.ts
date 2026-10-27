import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AuthService } from "../auth/auth.service.js";
import { checkRateLimit, throwIfRateLimited } from "../auth/rate-limit.js";
import { canAccessAccount, toPolicyActor } from "../policy/account-policy.js";
import { AccountDeletionImpactService } from "./account-deletion-impact.service.js";
import { SecuritySessionsService } from "./security-sessions.service.js";
import { SettingsOverviewService } from "./settings-overview.service.js";
import {
  emailChangeConfirmSchema,
  emailChangeRequestSchema,
  sessionIdParamSchema,
} from "./settings.validation.js";
import { assertEmailChangeAvailable } from "./settings-feature-gates.js";

function clientIp(req: AuthenticatedRequest): string {
  return req.ip ?? "unknown";
}

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createSettingsController(deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}) {
  const overview = new SettingsOverviewService(deps.db);
  const deletionImpact = new AccountDeletionImpactService(deps.db);
  const sessions = new SecuritySessionsService(deps.db);

  return {
    getOverview: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await overview.getOverview(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    getAccountDeletionImpact: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await deletionImpact.getImpact(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    listSessions: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const data = await sessions.listSessions(requireUser(req), req.authSessionId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    revokeSession: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { sessionId } = sessionIdParamSchema.parse(req.params);
      const data = await sessions.revokeSession(requireUser(req), sessionId, req.authSessionId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    requestEmailChange: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      assertEmailChangeAvailable(deps.env);
      const user = requireUser(req);
      const actor = toPolicyActor(user);
      if (!canAccessAccount(actor, user.id)) {
        throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
      }
      if (user.emailVerifiedAt === null) {
        throw new AppError("AUTH_FORBIDDEN", "Verify your email before changing it", 403);
      }

      const ip = clientIp(req);
      throwIfRateLimited(
        await checkRateLimit(
          `email-change:ip:${ip}`,
          deps.env.auth.AUTH_RATE_LIMIT_EMAIL_CHANGE_PER_IP,
          60_000,
        ),
      );
      throwIfRateLimited(
        await checkRateLimit(
          `email-change:user:${user.id}`,
          deps.env.auth.AUTH_RATE_LIMIT_EMAIL_CHANGE_PER_USER,
          60_000,
        ),
      );

      const body = emailChangeRequestSchema.parse(req.body);
      const result = await deps.authService.requestEmailChange(
        user.id,
        body.currentPassword,
        body.newEmail,
      );
      res.status(202).json({ data: result, meta: { requestId: req.requestId } });
    },

    confirmEmailChange: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      assertEmailChangeAvailable(deps.env);
      const body = emailChangeConfirmSchema.parse(req.body);
      const result = await deps.authService.confirmEmailChange(body.token);
      res.status(200).json({ data: result, meta: { requestId: req.requestId } });
    },
  };
}
