import type { Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AuthService } from "../auth/auth.service.js";
import { MembershipService } from "./membership.service.js";

function requireUser(req: AuthenticatedRequest) {
  if (!req.authUser) {
    throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
  }
  return req.authUser;
}

export function createMembershipController(_deps: {
  db: DatabaseClient;
  authService: AuthService;
  env: AppEnv;
}) {
  const service = new MembershipService();

  return {
    listPlans: (req: AuthenticatedRequest, res: Response): void => {
      const data = service.listPlans(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },

    getMyMembership: (req: AuthenticatedRequest, res: Response): void => {
      const data = service.getMyMembership(requireUser(req));
      res.status(200).json({ data, meta: { requestId: req.requestId } });
    },
  };
}
