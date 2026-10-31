import { noopMessagingRealtimeBus, type MessagingRealtimeBus } from "./messaging-realtime.bus.js";

let activeBus: MessagingRealtimeBus = noopMessagingRealtimeBus;

export function registerMessagingRealtimeBus(bus: MessagingRealtimeBus): void {
  activeBus = bus;
}

export function resetMessagingRealtimeBus(): void {
  activeBus = noopMessagingRealtimeBus;
}

export function messagingRealtimeBus(): MessagingRealtimeBus {
  return activeBus;
}
