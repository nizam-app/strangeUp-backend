import type { Server as HttpServer } from "node:http";
import type { Logger } from "pino";
import { Server } from "socket.io";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import type { AuthService } from "../auth/auth.service.js";
import { assertMessagingSocketEligible } from "./messaging-realtime.eligibility.js";
import {
  assertCanSubscribeDirectConversation,
  assertCanSubscribeGroupChat,
} from "./messaging-realtime.access.js";
import {
  dmRoom,
  groupRoom,
  MESSAGING_SOCKET_EVENTS,
  userRoom,
} from "./messaging-realtime.constants.js";
import { registerMessagingRealtimeBus } from "./messaging-realtime.registry.js";
import { SocketIoMessagingBus } from "./socket-io-messaging.bus.js";
import {
  subscribeDmSchema,
  subscribeGroupSchema,
  typingInputSchema,
} from "./messaging-realtime.validation.js";
import {
  clearTypingStateForSocket,
  shouldEmitTypingStart,
} from "./messaging-realtime.typing.js";
import {
  clearServerTypingExpiryForSocket,
  emitTypingStopEvent,
  scheduleServerTypingExpiry,
} from "./messaging-realtime.typing-expiry.js";
import { noopMessagingRealtimeBus } from "./messaging-realtime.bus.js";
import { registerMessagingSocketIo, clearMessagingSocketIo } from "./messaging-realtime.socket-control.js";
import type { MessagingSocketData } from "./messaging-realtime.types.js";

export type { MessagingSocketData };

function extractHandshakeToken(handshake: {
  auth?: unknown;
  headers: { authorization?: string };
}): string | null {
  const authPayload = handshake.auth;
  if (authPayload && typeof authPayload === "object" && "token" in authPayload) {
    const token = (authPayload as { token?: unknown }).token;
    if (typeof token === "string" && token.trim()) {
      return token.trim();
    }
  }
  const header = handshake.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  return null;
}

export type MessagingRealtimeHandle = {
  io: Server;
  close: () => Promise<void>;
};

export function attachMessagingRealtime(deps: {
  httpServer: HttpServer;
  db: DatabaseClient;
  env: AppEnv;
  authService: AuthService;
  logger: Logger;
}): MessagingRealtimeHandle | null {
  if (!deps.env.SOCKET_IO_ENABLED) {
    registerMessagingRealtimeBus(noopMessagingRealtimeBus);
    return null;
  }

  if (deps.env.SOCKET_IO_REDIS_ADAPTER_ENABLED) {
    throw new Error(
      "SOCKET_IO_REDIS_ADAPTER_ENABLED=true but Redis Socket.IO adapter is not implemented; set SOCKET_IO_REDIS_ADAPTER_ENABLED=false or complete adapter configuration",
    );
  }

  const io = new Server(deps.httpServer, {
    path: deps.env.SOCKET_IO_PATH,
    cors: {
      origin: deps.env.corsOriginsList,
      credentials: true,
    },
  });

  registerMessagingSocketIo(io);
  registerMessagingRealtimeBus(new SocketIoMessagingBus(io, deps.db, deps.env));

  io.use((socket, next) => {
    void (async () => {
      try {
        const token = extractHandshakeToken(socket.handshake);
        if (!token) {
          next(new Error("AUTH_UNAUTHORIZED"));
          return;
        }
        const { user, sessionId } = await deps.authService.resolveAuthenticatedUser(token);
        await assertMessagingSocketEligible(deps.db, deps.env, sessionId, user.id);
        socket.data = { userId: user.id, sessionId } satisfies MessagingSocketData;
        next();
      } catch {
        next(new Error("AUTH_UNAUTHORIZED"));
      }
    })();
  });

  io.on("connection", (socket) => {
    const data = socket.data as MessagingSocketData;
    void socket.join(userRoom(data.userId));
    socket.emit(MESSAGING_SOCKET_EVENTS.connected, {
      userId: data.userId,
      serverTime: new Date().toISOString(),
      syncHint:
        "REST remains authoritative; use GET message pages after reconnect to fill gaps. Dedupe by eventId / messageId.",
    });

    const guardSession = async (): Promise<boolean> => {
      try {
        await assertMessagingSocketEligible(deps.db, deps.env, data.sessionId, data.userId);
        return true;
      } catch {
        socket.emit(MESSAGING_SOCKET_EVENTS.error, {
          code: "AUTH_UNAUTHORIZED",
          message: "Session is no longer valid",
        });
        socket.disconnect(true);
        return false;
      }
    };

    const accountRecheck = setInterval(() => {
      void guardSession();
    }, deps.env.SOCKET_IO_ACCOUNT_RECHECK_INTERVAL_MS);
    accountRecheck.unref?.();

    socket.on(MESSAGING_SOCKET_EVENTS.subscribeDm, (payload: unknown) => {
      void (async () => {
        if (!(await guardSession())) {
          return;
        }
        const parsed = subscribeDmSchema.safeParse(payload);
        if (!parsed.success) {
          socket.emit(MESSAGING_SOCKET_EVENTS.error, {
            code: "VALIDATION_ERROR",
            message: "Invalid subscribe_dm payload",
          });
          return;
        }
        try {
          const user = await deps.db.user.findUniqueOrThrow({ where: { id: data.userId } });
          await assertCanSubscribeDirectConversation(deps.db, user, parsed.data.conversationId);
          await socket.join(dmRoom(parsed.data.conversationId));
          socket.emit(MESSAGING_SOCKET_EVENTS.subscribed, {
            kind: "dm",
            id: parsed.data.conversationId,
          });
        } catch {
          socket.emit(MESSAGING_SOCKET_EVENTS.error, {
            code: "NOT_FOUND",
            message: "Conversation unavailable",
          });
        }
      })();
    });

    socket.on(MESSAGING_SOCKET_EVENTS.unsubscribeDm, (payload: unknown) => {
      const parsed = subscribeDmSchema.safeParse(payload);
      if (!parsed.success) {
        return;
      }
      void socket.leave(dmRoom(parsed.data.conversationId));
      socket.emit(MESSAGING_SOCKET_EVENTS.unsubscribed, {
        kind: "dm",
        id: parsed.data.conversationId,
      });
    });

    socket.on(MESSAGING_SOCKET_EVENTS.subscribeGroup, (payload: unknown) => {
      void (async () => {
        if (!(await guardSession())) {
          return;
        }
        const parsed = subscribeGroupSchema.safeParse(payload);
        if (!parsed.success) {
          socket.emit(MESSAGING_SOCKET_EVENTS.error, {
            code: "VALIDATION_ERROR",
            message: "Invalid subscribe_group payload",
          });
          return;
        }
        try {
          const user = await deps.db.user.findUniqueOrThrow({ where: { id: data.userId } });
          await assertCanSubscribeGroupChat(deps.db, user, parsed.data.groupId);
          await socket.join(groupRoom(parsed.data.groupId));
          socket.emit(MESSAGING_SOCKET_EVENTS.subscribed, { kind: "group", id: parsed.data.groupId });
        } catch {
          socket.emit(MESSAGING_SOCKET_EVENTS.error, {
            code: "NOT_FOUND",
            message: "Group chat unavailable",
          });
        }
      })();
    });

    socket.on(MESSAGING_SOCKET_EVENTS.unsubscribeGroup, (payload: unknown) => {
      const parsed = subscribeGroupSchema.safeParse(payload);
      if (!parsed.success) {
        return;
      }
      void socket.leave(groupRoom(parsed.data.groupId));
      socket.emit(MESSAGING_SOCKET_EVENTS.unsubscribed, {
        kind: "group",
        id: parsed.data.groupId,
      });
    });

    socket.on(MESSAGING_SOCKET_EVENTS.typingInput, (payload: unknown) => {
      void (async () => {
        if (!(await guardSession())) {
          return;
        }
        const parsed = typingInputSchema.safeParse(payload);
        if (!parsed.success) {
          return;
        }
        const roomKey =
          parsed.data.target === "dm"
            ? dmRoom(parsed.data.id)
            : groupRoom(parsed.data.id);
        try {
          if (parsed.data.target === "dm") {
            const user = await deps.db.user.findUniqueOrThrow({ where: { id: data.userId } });
            await assertCanSubscribeDirectConversation(deps.db, user, parsed.data.id);
          } else {
            const user = await deps.db.user.findUniqueOrThrow({ where: { id: data.userId } });
            await assertCanSubscribeGroupChat(deps.db, user, parsed.data.id);
          }
        } catch {
          return;
        }

        if (parsed.data.active) {
          const ok = shouldEmitTypingStart(
            data.userId,
            roomKey,
            deps.env.SOCKET_IO_TYPING_MIN_INTERVAL_MS,
          );
          if (!ok) {
            return;
          }
        }

        socket.to(roomKey).emit(MESSAGING_SOCKET_EVENTS.typing, {
          eventId: `${data.userId}:${roomKey}:${parsed.data.active ? "start" : "stop"}`,
          target: parsed.data.target,
          id: parsed.data.id,
          userId: data.userId,
          active: parsed.data.active,
        });

        if (parsed.data.active) {
          scheduleServerTypingExpiry({
            socketId: socket.id,
            roomKey,
            ttlMs: deps.env.SOCKET_IO_TYPING_TTL_MS,
            stopContext: {
              target: parsed.data.target,
              id: parsed.data.id,
              userId: data.userId,
            },
            emitStop: (ctx) => {
              emitTypingStopEvent(
                (event, payload) => {
                  socket.to(roomKey).emit(event, payload);
                },
                ctx,
              );
            },
          });
        }
      })();
    });

    socket.on("disconnect", () => {
      clearInterval(accountRecheck);
      clearServerTypingExpiryForSocket(socket.id);
      clearTypingStateForSocket(data.userId);
    });
  });

  deps.logger.info(
    {
      path: deps.env.SOCKET_IO_PATH,
      redisAdapter: deps.env.SOCKET_IO_REDIS_ADAPTER_ENABLED,
    },
    "Socket.IO messaging realtime attached (single-instance; Redis adapter disabled unless explicitly enabled)",
  );

  return {
    io,
    close: async () => {
      clearMessagingSocketIo();
      await io.close();
    },
  };
}
