import { createServer, type Server as HttpServer } from "node:http";
import type pino from "pino";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import type { AppEnv } from "../../src/config/env.js";
import { createApp } from "../../src/app.js";
import type { DatabaseClient } from "../../src/infrastructure/database/prisma.js";
import { createAuthController } from "../../src/modules/auth/auth.controller.js";
import type { EmailSender } from "../../src/modules/auth/email-sender.js";
import { attachMessagingRealtime } from "../../src/modules/messaging-realtime/messaging-realtime.server.js";
import { configureMessagingRealtimePublishLogger } from "../../src/modules/messaging-realtime/messaging-realtime.publish.js";
import { MESSAGING_SOCKET_EVENTS } from "../../src/modules/messaging-realtime/messaging-realtime.constants.js";

export type MessagingSocketHarness = {
  app: ReturnType<typeof createApp>;
  httpServer: HttpServer;
  baseUrl: string;
  connectClient: (accessToken: string) => ClientSocket;
  close: () => Promise<void>;
};

export async function startMessagingSocketHarness(deps: {
  env: AppEnv;
  logger: pino.Logger;
  db: DatabaseClient;
  emailSender: EmailSender;
}): Promise<MessagingSocketHarness> {
  configureMessagingRealtimePublishLogger(deps.logger);
  const app = createApp({
    env: deps.env,
    logger: deps.logger,
    db: deps.db,
    emailSender: deps.emailSender,
  });
  const httpServer = createServer(app);
  const authController = createAuthController({
    db: deps.db,
    env: deps.env,
    emailSender: deps.emailSender,
    logger: deps.logger,
  });
  attachMessagingRealtime({
    httpServer,
    db: deps.db,
    env: deps.env,
    authService: authController.authService,
    logger: deps.logger,
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => resolve());
  });
  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test HTTP server");
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    app,
    httpServer,
    baseUrl,
    connectClient(accessToken: string) {
      return ioClient(baseUrl, {
        path: deps.env.SOCKET_IO_PATH,
        transports: ["websocket"],
        auth: { token: accessToken },
        autoConnect: true,
      });
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        httpServer.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      }),
  };
}

export function waitForSocketEvent<T>(
  socket: ClientSocket,
  event: string,
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

export { MESSAGING_SOCKET_EVENTS };
