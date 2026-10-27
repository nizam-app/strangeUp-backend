import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AppEnv } from "../../config/env.js";
import { VerificationService } from "./verification.service.js";
import { startVerificationSessionBodySchema } from "./verification.validation.js";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createVerificationController(deps: { db: DatabaseClient; env: AppEnv }) {
  const service = new VerificationService(deps.db, deps.env);

  return {
    service,
    async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
      const data = await service.getSelfServiceStatus(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    async startSession(req: AuthenticatedRequest, res: Response): Promise<void> {
      const body = startVerificationSessionBodySchema.parse(req.body ?? {});
      const data = await service.startSession(requireUser(req), body);
      res.status(201).json({ data, meta: { requestId: req.requestId } });
    },
    async getSession(req: AuthenticatedRequest, res: Response): Promise<void> {
      const sessionId = String(req.params.sessionId);
      const data = await service.getSession(requireUser(req), sessionId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
    async cancelSession(req: AuthenticatedRequest, res: Response): Promise<void> {
      const sessionId = String(req.params.sessionId);
      const data = await service.cancelSession(requireUser(req), sessionId);
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}

export type VerificationController = ReturnType<typeof createVerificationController>;
