import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { User } from "../../../generated/prisma/client.js";
import type { AuthService } from "../../modules/auth/auth.service.js";

export type AuthenticatedRequest = Request & {
  authUser?: User;
  authSessionId?: string;
};

export function createAuthenticateMiddleware(authService: AuthService): RequestHandler {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({
        error: {
          code: "AUTH_UNAUTHORIZED",
          message: "Missing or invalid authorization",
          requestId: req.requestId,
        },
      });
      return;
    }
    const token = header.slice("Bearer ".length).trim();
    try {
      const { user, sessionId } = await authService.resolveAuthenticatedUser(token);
      req.authUser = user;
      req.authSessionId = sessionId;
      next();
    } catch (err: unknown) {
      next(err);
    }
  };
}
