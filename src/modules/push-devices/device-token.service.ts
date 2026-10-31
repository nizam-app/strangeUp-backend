import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { hashSha256 } from "../auth/crypto.js";
import { assertFullAccess } from "../social/social-access.js";
import { toDevicePlatformDto, type DeviceTokenListItemDto } from "./device-token.dto.js";
import type { registerDeviceTokenBodySchema } from "./device-token.validation.js";
import type { z } from "zod";

function mapPlatform(input: "android" | "ios") {
  return input === "android" ? ("ANDROID" as const) : ("IOS" as const);
}

export async function revokeDeviceTokensForSession(
  db: DatabaseClient,
  userId: string,
  sessionId: string,
): Promise<void> {
  await db.userDeviceToken.updateMany({
    where: { userId, sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeDeviceTokensForUser(db: DatabaseClient, userId: string): Promise<void> {
  await db.userDeviceToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export class DeviceTokenService {
  constructor(private readonly db: DatabaseClient) {}

  async register(
    viewer: User,
    sessionId: string | undefined,
    input: z.infer<typeof registerDeviceTokenBodySchema>,
  ): Promise<DeviceTokenListItemDto> {
    assertFullAccess(viewer);
    const platform = mapPlatform(input.platform);
    const tokenSha256 = hashSha256(input.registrationToken.trim());
    const now = new Date();

    const existingByBinding = await this.db.userDeviceToken.findUnique({
      where: {
        userId_deviceBindingId: {
          userId: viewer.id,
          deviceBindingId: input.deviceBindingId,
        },
      },
    });
    const existingByToken = await this.db.userDeviceToken.findUnique({
      where: { tokenSha256 },
    });

    if (
      existingByToken &&
      existingByToken.id !== existingByBinding?.id &&
      existingByToken.userId !== viewer.id
    ) {
      await this.db.userDeviceToken.update({
        where: { id: existingByToken.id },
        data: { revokedAt: now },
      });
    }

    if (existingByToken && existingByToken.userId !== viewer.id) {
      await this.db.userDeviceToken
        .delete({ where: { id: existingByToken.id } })
        .catch(() => undefined);
    }

    const row = existingByBinding
      ? await this.db.userDeviceToken.update({
          where: { id: existingByBinding.id },
          data: {
            platform,
            tokenSha256,
            registrationToken: input.registrationToken.trim(),
            sessionId: sessionId ?? null,
            lastSeenAt: now,
            revokedAt: null,
          },
        })
      : await this.db.userDeviceToken.create({
          data: {
            userId: viewer.id,
            platform,
            tokenSha256,
            registrationToken: input.registrationToken.trim(),
            deviceBindingId: input.deviceBindingId,
            sessionId: sessionId ?? null,
            lastSeenAt: now,
            revokedAt: null,
          },
        });

    return {
      deviceTokenId: row.id,
      platform: toDevicePlatformDto(row.platform),
      deviceBindingId: row.deviceBindingId,
      lastSeenAt: row.lastSeenAt.toISOString(),
      registeredAt: row.createdAt.toISOString(),
    };
  }

  async list(viewer: User): Promise<DeviceTokenListItemDto[]> {
    assertFullAccess(viewer);
    const rows = await this.db.userDeviceToken.findMany({
      where: { userId: viewer.id, revokedAt: null },
      orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
    });
    return rows.map((row) => ({
      deviceTokenId: row.id,
      platform: toDevicePlatformDto(row.platform),
      deviceBindingId: row.deviceBindingId,
      lastSeenAt: row.lastSeenAt.toISOString(),
      registeredAt: row.createdAt.toISOString(),
    }));
  }

  async revoke(viewer: User, deviceTokenId: string): Promise<{ revoked: true }> {
    assertFullAccess(viewer);
    const row = await this.db.userDeviceToken.findUnique({ where: { id: deviceTokenId } });
    if (!row || row.userId !== viewer.id) {
      throw new AppError("NOT_FOUND", "Not found", 404);
    }
    if (row.revokedAt === null) {
      await this.db.userDeviceToken.update({
        where: { id: deviceTokenId },
        data: { revokedAt: new Date() },
      });
    }
    return { revoked: true };
  }
}
