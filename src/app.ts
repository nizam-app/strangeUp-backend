import cors from "cors";
import express from "express";
import { createVerificationWebhookController } from "./modules/verification/verification-webhook.controller.js";
import { createConsentRouter } from "./modules/consent/consent.routes.js";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Logger } from "pino";
import type { AppEnv } from "./config/env.js";
import { createErrorHandler, notFoundHandler } from "./common/middleware/error-handler.js";
import { requestIdMiddleware } from "./common/middleware/request-id.js";
import { redactSensitive } from "./common/utils/redact.js";
import type { DatabaseClient } from "./infrastructure/database/prisma.js";
import { resolveEmailSender } from "./modules/auth/email-sender.js";
import { createAuthController } from "./modules/auth/auth.controller.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createInterestsRouter } from "./modules/interests/interests.routes.js";
import { createDiscoverRouter } from "./modules/discovery/discovery.routes.js";
import { createPublicUsersRouter } from "./modules/discovery/public-users.routes.js";
import { createSocialUsersRouter } from "./modules/social/social.routes.js";
import { createMeRouter } from "./modules/me/me.routes.js";
import {
  createActivitiesRouter,
  createActivityCategoriesRouter,
} from "./modules/activities/activities.routes.js";
import { createGroupCategoriesRouter, createGroupsRouter } from "./modules/groups/groups.routes.js";
import { createHomeRouter } from "./modules/home/home.routes.js";
import { createStoreRouter } from "./modules/store/store.routes.js";
import { createJobsRouter } from "./modules/jobs/job.routes.js";
import { createMembershipRouter } from "./modules/membership/membership.routes.js";
import { createMeetupInvitesRouter } from "./modules/meetup-invites/meetup-invite.routes.js";
import { createAdminRouter } from "./modules/admin/admin.routes.js";
import { createRequireHomeAccessMiddleware } from "./common/middleware/require-home-access.js";
import { createAuthenticateMiddleware } from "./common/middleware/authenticate.js";
import { createHealthRouter } from "./routes/health.js";
import type { EmailSender } from "./modules/auth/email-sender.js";

export type CreateAppDeps = {
  env: AppEnv;
  logger: Logger;
  db: DatabaseClient | null;
  emailSender?: EmailSender;
};

export function createApp(deps: CreateAppDeps): express.Application {
  const app = express();
  const { env, logger, db } = deps;
  const emailSender =
    deps.emailSender ??
    resolveEmailSender({
      mode: env.transactionalEmail.mode,
      logger,
      fromAddress: env.transactionalEmail.fromAddress,
      resendApiKey: env.RESEND_API_KEY,
      requestTimeoutMs: env.RESEND_REQUEST_TIMEOUT_MS,
      maxRetries: env.RESEND_MAX_RETRIES,
    });

  if (env.TRUST_PROXY) {
    app.set("trust proxy", 1);
  }

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      customProps: (req: express.Request) => ({ requestId: req.requestId }),
      serializers: {
        req: (req: express.Request) =>
          redactSensitive({
            method: req.method,
            url: req.url,
            headers: req.headers,
          }),
        res: (res: express.Response) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.use(
    cors({
      origin: env.corsOriginsList,
      credentials: true,
    }),
  );

  app.use("/v1/consents", createConsentRouter({ env }));

  if (db) {
    const verificationWebhookController = createVerificationWebhookController({ db, env });
    app.use(
      "/v1/webhooks/verification/:provider",
      express.raw({ type: "application/json", limit: env.KYC_WEBHOOK_BODY_LIMIT_BYTES }),
      (req, res, next) => {
        void verificationWebhookController.handleVerificationWebhook(req, res).catch(next);
      },
    );
  }

  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));

  app.use("/health", createHealthRouter({ db }));

  if (db) {
    const authController = createAuthController({ db, env, emailSender, logger });
    app.use(
      "/v1/auth",
      createAuthRouter({ db, env, emailSender, logger, controller: authController }),
    );
    app.use(
      "/v1/interests",
      createInterestsRouter({ db, authService: authController.authService }),
    );
    const authService = authController.authService;
    const authenticate = createAuthenticateMiddleware(authService);
    const requireHomeAccess = createRequireHomeAccessMiddleware({ db, env });

    const mountMainApp = (path: string, router: express.Router) => {
      const gated = express.Router();
      gated.use(authenticate, requireHomeAccess);
      gated.use(router);
      app.use(path, gated);
    };

    app.use("/v1/me", createMeRouter({ db, authService, env }));
    mountMainApp("/v1/discover", createDiscoverRouter({ db, authService, env }));
    mountMainApp("/v1/users", createPublicUsersRouter({ db, authService, env }));
    mountMainApp("/v1/users", createSocialUsersRouter({ db, authService, env }));
    mountMainApp(
      "/v1/activity-categories",
      createActivityCategoriesRouter({ db, authService, env }),
    );
    mountMainApp("/v1/activities", createActivitiesRouter({ db, authService, env }));
    mountMainApp("/v1/group-categories", createGroupCategoriesRouter({ db, authService, env }));
    mountMainApp("/v1/groups", createGroupsRouter({ db, authService, env }));
    mountMainApp("/v1/home", createHomeRouter({ db, authService, env }));
    mountMainApp("/v1/store", createStoreRouter({ db, authService, env }));
    mountMainApp("/v1/jobs", createJobsRouter({ db, authService, env }));
    mountMainApp("/v1/membership", createMembershipRouter({ db, authService, env }));
    mountMainApp("/v1/meetup-invites", createMeetupInvitesRouter({ db, authService, env }));
    app.use("/v1/admin", createAdminRouter({ db, authService, env }));
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler({ logger, isProduction: env.isProduction }));

  return app;
}
