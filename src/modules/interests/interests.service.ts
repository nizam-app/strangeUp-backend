import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { canAccessAccount, canEditProfile, toPolicyActor } from "../policy/account-policy.js";
import type { ReplaceInterestsInput } from "./interests.validation.js";

export type InterestItemDto = {
  slug: string;
  label: string;
};

export type InterestsSelectionDto = {
  interests: InterestItemDto[];
};

export class InterestsService {
  constructor(private readonly db: DatabaseClient) {}

  async listCatalog(user: User): Promise<InterestsSelectionDto> {
    const actor = toPolicyActor(user);
    if (!canAccessAccount(actor, user.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    const rows = await this.db.interest.findMany({
      orderBy: { sortOrder: "asc" },
      select: { slug: true, label: true },
    });
    return { interests: rows };
  }

  async getMyInterests(user: User): Promise<InterestsSelectionDto> {
    const actor = toPolicyActor(user);
    if (!canAccessAccount(actor, user.id)) {
      throw new AppError("AUTH_FORBIDDEN", "Account is not available", 403);
    }

    const rows = await this.db.userInterest.findMany({
      where: { userId: user.id },
      include: { interest: { select: { slug: true, label: true, sortOrder: true } } },
      orderBy: { interest: { sortOrder: "asc" } },
    });

    return {
      interests: rows.map((row) => ({
        slug: row.interest.slug,
        label: row.interest.label,
      })),
    };
  }

  async replaceMyInterests(
    user: User,
    input: ReplaceInterestsInput,
  ): Promise<InterestsSelectionDto> {
    const actor = toPolicyActor(user);
    if (!canEditProfile(actor, user.id)) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Profile cannot be edited in the current account state",
        403,
      );
    }

    const slugs = input.interests;
    const catalogRows = await this.db.interest.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, slug: true, label: true, sortOrder: true },
    });

    if (catalogRows.length !== slugs.length) {
      throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
    }

    const bySlug = new Map(catalogRows.map((row) => [row.slug, row]));
    const ordered = slugs.map((slug) => bySlug.get(slug)!);

    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
      await tx.userInterest.deleteMany({ where: { userId: user.id } });
      if (ordered.length > 0) {
        await tx.userInterest.createMany({
          data: ordered.map((row) => ({
            userId: user.id,
            interestId: row.id,
          })),
        });
      }
    });

    return {
      interests: ordered.map((row) => ({ slug: row.slug, label: row.label })),
    };
  }
}
