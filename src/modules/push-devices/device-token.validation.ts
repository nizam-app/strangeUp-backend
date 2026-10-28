import { z } from "zod";

export const registerDeviceTokenBodySchema = z
  .object({
    platform: z.enum(["android", "ios"]),
    registrationToken: z.string().min(20).max(4096),
    deviceBindingId: z.string().min(8).max(128),
  })
  .strict();

export const deviceTokenIdParamSchema = z.object({
  deviceTokenId: z.string().uuid(),
});
