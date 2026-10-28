import "dotenv/config";
import { createServer } from "node:http";
import pino from "pino";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { disconnectPrisma, getPrismaClient } from "./infrastructure/database/prisma.js";
import {
  configureRateLimitStore,
  disconnectRateLimitStore,
  resolveRateLimitStore,
} from "./modules/auth/rate-limit.js";
import { createAuthController } from "./modules/auth/auth.controller.js";
import { resolveEmailSender } from "./modules/auth/email-sender.js";
import { attachMessagingRealtime } from "./modules/messaging-realtime/messaging-realtime.server.js";
import { configureMessagingRealtimePublishLogger } from "./modules/messaging-realtime/messaging-realtime.publish.js";
import { resetMessagingRealtimeBus } from "./modules/messaging-realtime/messaging-realtime.registry.js";
import { startPushOutboxWorker } from "./modules/push-delivery/push-outbox.worker.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        "DATABASE_URL",
        "RATE_LIMIT_REDIS_URL",
        "RESEND_API_KEY",
        "req.headers.authorization",
        "password",
        "secret",
        "FIREBASE_CREDENTIALS_FILE",
        "registrationToken",
      ],
      censor: "[REDACTED]",
    },
  });

  configureMessagingRealtimePublishLogger(logger);
  configureRateLimitStore(await resolveRateLimitStore(env, logger));

  const db = env.DATABASE_URL ? getPrismaClient(env.DATABASE_URL) : null;
  const emailSender = resolveEmailSender({
    mode: env.transactionalEmail.mode,
    logger,
    fromAddress: env.transactionalEmail.fromAddress,
    resendApiKey: env.RESEND_API_KEY,
    requestTimeoutMs: env.RESEND_REQUEST_TIMEOUT_MS,
    maxRetries: env.RESEND_MAX_RETRIES,
  });
  const app = createApp({ env, logger, db, emailSender });

  const httpServer = createServer(app);
  let messagingRealtime: ReturnType<typeof attachMessagingRealtime> = null;
  let pushWorker: ReturnType<typeof startPushOutboxWorker> | null = null;

  if (db) {
    const authController = createAuthController({ db, env, emailSender, logger });
    messagingRealtime = attachMessagingRealtime({
      httpServer,
      db,
      env,
      authService: authController.authService,
      logger,
    });
    pushWorker = startPushOutboxWorker({ db, env, logger });
  } else {
    resetMessagingRealtimeBus();
  }

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, "server listening");
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutdown requested");
    const closeSockets = messagingRealtime
      ? messagingRealtime.close().catch((err: unknown) => {
          logger.warn({ err }, "Socket.IO close error");
        })
      : Promise.resolve();

    pushWorker?.stop();
    void closeSockets.finally(() => {
      httpServer.close(() => {
        void disconnectRateLimitStore()
          .then(() => disconnectPrisma())
          .then(() => {
            resetMessagingRealtimeBus();
            logger.info("server stopped");
            process.exit(0);
          });
      });
    });

    setTimeout(() => {
      logger.error("forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

try {
  await main();
} catch (err: unknown) {
  console.error(err);
  process.exit(1);
}
