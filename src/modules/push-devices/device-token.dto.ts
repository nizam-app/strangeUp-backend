import type { DevicePlatform } from "../../../generated/prisma/client.js";

export type DeviceTokenListItemDto = {
  deviceTokenId: string;
  platform: Lowercase<DevicePlatform>;
  deviceBindingId: string;
  lastSeenAt: string;
  registeredAt: string;
};

export function toDevicePlatformDto(platform: DevicePlatform): Lowercase<DevicePlatform> {
  return platform === "ANDROID" ? "android" : "ios";
}
