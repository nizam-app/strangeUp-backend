import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../../common/middleware/authenticate.js";
import { AppError } from "../../common/errors/app-error.js";
import type { ApiSuccessResponse } from "../../common/types/api.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { AuthService, consumeIdempotency, storeIdempotency } from "./auth.service.js";
import {
  emailVerifyConfirmSchema,
  loginBodySchema,
  logoutBodySchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  refreshBodySchema,
  registerBodySchema,
} from "./auth.validation.js";
import { hashIp } from "./crypto.js";
import { checkRateLimit } from "./rate-limit.js";
import type { EmailSender } from "./email-sender.js";

const IDEMPOTENCY_HEADER = "idempotency-key";

function clientIp(req: Request): string {
  return req.ip ?? "unknown";
}

function hashRequestPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function createAuthController(deps: {
  db: DatabaseClient;
  env: AppEnv;
  emailSender: EmailSender;
}) {
  const authService = new AuthService(deps.db, deps.env.auth, deps.emailSender);

  return {
    register: async (req: Request, res: Response): Promise<void> => {
      const ip = clientIp(req);
      const registerLimit = checkRateLimit(
        `register:ip:${ip}`,
        deps.env.auth.AUTH_RATE_LIMIT_REGISTER_PER_IP,
        60_000,
      );
      if (!registerLimit.allowed) {
        throw new AppError("AUTH_RATE_LIMITED", "Too many requests", 429);
      }

      const body = registerBodySchema.parse(req.body);
      const idempotencyKey = req.header(IDEMPOTENCY_HEADER)?.trim();
      const requestHash = hashRequestPayload(body);

      if (idempotencyKey) {
        const cached = await consumeIdempotency(deps.db, idempotencyKey, requestHash);
        if (cached) {
          res.status(201).json(JSON.parse(cached) as ApiSuccessResponse<unknown>);
          return;
        }
      }

      const result = await authService.register({
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        password: body.password,
        dateOfBirth: body.dateOfBirth,
        consents: body.consents,
        ipHash: hashIp(ip),
      });

      const envelope: ApiSuccessResponse<typeof result> = {
        data: result,
        meta: { requestId: req.requestId },
      };

      if (idempotencyKey) {
        await storeIdempotency(deps.db, idempotencyKey, requestHash, JSON.stringify(envelope));
      }

      res.status(201).json(envelope);
    },

    login: async (req: Request, res: Response): Promise<void> => {
      const body = loginBodySchema.parse(req.body);
      const ip = clientIp(req);
      const emailKey = createHash("sha256").update(body.email.toLowerCase(), "utf8").digest("hex");

      const ipLimit = checkRateLimit(
        `login:ip:${ip}`,
        deps.env.auth.AUTH_RATE_LIMIT_LOGIN_PER_IP,
        60_000,
      );
      if (!ipLimit.allowed) {
        throw new AppError("AUTH_RATE_LIMITED", "Too many requests", 429);
      }
      const emailLimit = checkRateLimit(
        `login:email:${emailKey}`,
        deps.env.auth.AUTH_RATE_LIMIT_LOGIN_PER_EMAIL,
        60_000,
      );
      if (!emailLimit.allowed) {
        throw new AppError("AUTH_RATE_LIMITED", "Too many requests", 429);
      }

      const { tokens, user } = await authService.login(body.email, body.password, {
        userAgent: req.header("user-agent") ?? undefined,
        ipHash: hashIp(ip),
      });

      res.status(200).json({
        data: {
          ...tokens,
          user,
        },
        meta: { requestId: req.requestId },
      });
    },

    refresh: async (req: Request, res: Response): Promise<void> => {
      const body = refreshBodySchema.parse(req.body);
      const tokens = await authService.refresh(body.refreshToken);
      res.status(200).json({ data: tokens, meta: { requestId: req.requestId } });
    },

    logout: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const body = logoutBodySchema.parse(req.body ?? {});
      if (!req.authSessionId) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      await authService.logout(req.authSessionId, body.refreshToken);
      res.status(200).json({ data: { success: true }, meta: { requestId: req.requestId } });
    },

    logoutAll: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      await authService.logoutAll(req.authUser.id);
      res.status(200).json({ data: { success: true }, meta: { requestId: req.requestId } });
    },

    requestEmailVerification: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.authUser) {
        throw new AppError("AUTH_UNAUTHORIZED", "Not authenticated", 401);
      }
      const verifyLimit = checkRateLimit(
        `email-verify:user:${req.authUser.id}`,
        deps.env.auth.AUTH_RATE_LIMIT_EMAIL_VERIFY_PER_USER,
        60_000,
      );
      if (!verifyLimit.allowed) {
        throw new AppError("AUTH_RATE_LIMITED", "Too many requests", 429);
      }
      await authService.requestEmailVerification(req.authUser.id);
      res.status(202).json({
        data: { message: "If verification is required, instructions were sent." },
        meta: { requestId: req.requestId },
      });
    },

    confirmEmailVerification: async (req: Request, res: Response): Promise<void> => {
      const body = emailVerifyConfirmSchema.parse(req.body);
      const result = await authService.confirmEmailVerification(body.token);
      res.status(200).json({
        data: {
          accountStatus: result.accountStatus,
          emailVerified: true,
        },
        meta: { requestId: req.requestId },
      });
    },

    requestPasswordReset: async (req: Request, res: Response): Promise<void> => {
      const body = passwordResetRequestSchema.parse(req.body);
      const ip = clientIp(req);
      const emailKey = createHash("sha256").update(body.email.toLowerCase(), "utf8").digest("hex");

      const ipLimit = checkRateLimit(
        `password-reset:ip:${ip}`,
        deps.env.auth.AUTH_RATE_LIMIT_PASSWORD_RESET_PER_IP,
        60_000,
      );
      if (!ipLimit.allowed) {
        throw new AppError("AUTH_RATE_LIMITED", "Too many requests", 429);
      }
      const emailLimit = checkRateLimit(
        `password-reset:email:${emailKey}`,
        deps.env.auth.AUTH_RATE_LIMIT_PASSWORD_RESET_PER_EMAIL,
        60_000,
      );
      if (!emailLimit.allowed) {
        throw new AppError("AUTH_RATE_LIMITED", "Too many requests", 429);
      }

      await authService.requestPasswordReset(body.email);
      res.status(202).json({
        data: { message: "If an account exists, instructions were sent." },
        meta: { requestId: req.requestId },
      });
    },

    confirmPasswordReset: async (req: Request, res: Response): Promise<void> => {
      const body = passwordResetConfirmSchema.parse(req.body);
      await authService.confirmPasswordReset(body.token, body.newPassword);
      res.status(200).json({
        data: { success: true },
        meta: { requestId: req.requestId },
      });
    },

    authService,
  };
}

export type AuthController = ReturnType<typeof createAuthController>;
