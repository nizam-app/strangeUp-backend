import type { Logger } from "pino";
import type {
  DirectMessagePublished,
  DirectReadPublished,
  GroupMessagePublished,
  GroupReadPublished,
} from "./messaging-realtime.bus.js";
import { messagingRealtimeBus } from "./messaging-realtime.registry.js";

let errorLogger: Logger | undefined;

export function configureMessagingRealtimePublishLogger(logger: Logger): void {
  errorLogger = logger;
}

function logPublishError(context: string, err: unknown): void {
  errorLogger?.warn({ err, context }, "messaging realtime publish failed");
}

export function publishDirectMessageSafe(event: DirectMessagePublished): void {
  void messagingRealtimeBus()
    .publishDirectMessage(event)
    .catch((err) => logPublishError("direct_message", err));
}

export function publishDirectReadSafe(event: DirectReadPublished): void {
  void messagingRealtimeBus()
    .publishDirectRead(event)
    .catch((err) => logPublishError("direct_read", err));
}

export function publishGroupMessageSafe(event: GroupMessagePublished): void {
  void messagingRealtimeBus()
    .publishGroupMessage(event)
    .catch((err) => logPublishError("group_message", err));
}

export function publishGroupReadSafe(event: GroupReadPublished): void {
  void messagingRealtimeBus()
    .publishGroupRead(event)
    .catch((err) => logPublishError("group_read", err));
}
