import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { canAccessAccount, canEditProfile, toPolicyActor } from "../policy/account-policy.js";
import type { ReplaceFavoriteActivitiesInput } from "./favorite-activities.validation.js";

export type FavoriteActivityDto = {
  title: string;
  skillLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  cadence: "WEEKLY" | "CASUAL";
  scheduleNote: string | null;
  placeLabel: string | null;
};

export type FavoriteActivitiesDto = {
  favoriteActivities: FavoriteActivityDto[];
};

export class FavoriteActivitiesService {
  constructor(private readonly db: DatabaseClient) {}

  async getMyFavoriteActivities(user: User): Promise<FavoriteActivitiesDto> {
    const actor = toPolicyActor(user);
    if (!canAccessAccount(actor, user.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    const rows = await this.db.profileFavoriteActivity.findMany({
      where: { userId: user.id },
      orderBy: { sortOrder: "asc" },
    });

    return {
      favoriteActivities: rows.map((row) => ({
        title: row.title,
        skillLevel: row.skillLevel,
        cadence: row.cadence,
        scheduleNote: row.scheduleNote,
        placeLabel: row.placeLabel,
      })),
    };
  }

  async replaceMyFavoriteActivities(
    user: User,
    input: ReplaceFavoriteActivitiesInput,
  ): Promise<FavoriteActivitiesDto> {
    const actor = toPolicyActor(user);
    if (!canEditProfile(actor, user.id)) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Profile cannot be edited in the current account state",
        403,
      );
    }

    const items = input.favoriteActivities;

    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
      await tx.profileFavoriteActivity.deleteMany({ where: { userId: user.id } });
      if (items.length > 0) {
        await tx.profileFavoriteActivity.createMany({
          data: items.map((item, index) => ({
            userId: user.id,
            sortOrder: index,
            title: item.title,
            skillLevel: item.skillLevel,
            cadence: item.cadence,
            scheduleNote: item.scheduleNote ?? null,
            placeLabel: item.placeLabel ?? null,
          })),
        });
      }
    });

    return this.getMyFavoriteActivities(user);
  }
}
