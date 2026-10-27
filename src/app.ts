import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Logger } from "pino";
import type { AppEnv } from "./config/env.js";
import { createErrorHandler, notFoundHandler } from "./common/middleware/error-handler.js";
import { requestIdMiddleware } from "./common/middleware/request-id.js";
import { redactSensitive } from "./common/utils/redact.js";
import type { DatabaseClient } from "./infrastructure/database/prisma.js";
import { createDevEmailSender } from "./modules/auth/email-sender.js";
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
  const emailSender = deps.emailSender ?? createDevEmailSender(logger);

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

  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));

  app.use("/health", createHealthRouter({ db }));

  if (db) {
    const authController = createAuthController({ db, env, emailSender });
    app.use("/v1/auth", createAuthRouter({ db, env, emailSender, controller: authController }));
    app.use(
      "/v1/interests",
      createInterestsRouter({ db, authService: authController.authService }),
    );
    const authService = authController.authService;
    app.use("/v1/me", createMeRouter({ db, authService, env }));
    app.use("/v1/discover", createDiscoverRouter({ db, authService }));
    app.use("/v1/users", createPublicUsersRouter({ db, authService, env }));
    app.use("/v1/users", createSocialUsersRouter({ db, authService, env }));
    app.use("/v1/activity-categories", createActivityCategoriesRouter({ db, authService, env }));
    app.use("/v1/activities", createActivitiesRouter({ db, authService, env }));
    app.use("/v1/group-categories", createGroupCategoriesRouter({ db, authService, env }));
    app.use("/v1/groups", createGroupsRouter({ db, authService, env }));
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler({ logger, isProduction: env.isProduction }));

  return app;
}
