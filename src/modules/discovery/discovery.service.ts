import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { toPolicyActor } from "../policy/account-policy.js";
import { canBrowseDiscovery, toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import { buildDiscoverableUsersWhere } from "./discover-query.js";
import { DISCOVER_PEOPLE_DEFAULT_LIMIT, DISCOVER_PEOPLE_MAX_LIMIT } from "./discovery.constants.js";
import { decodeDiscoverCursor, encodeDiscoverCursor } from "./discovery-cursor.js";
import type { discoverPeopleQuerySchema } from "./discovery.validation.js";
import { toPublicProfilePreview } from "./public-profile.dto.js";
import type { z } from "zod";

export class DiscoveryService {
  constructor(private readonly db: DatabaseClient) {}

  async listDiscoverablePeople(
    viewer: User,
    query: z.infer<typeof discoverPeopleQuerySchema>,
  ): Promise<{ people: ReturnType<typeof toPublicProfilePreview>[]; nextCursor: string | null }> {
    const actor = toPolicyActor(viewer);
    if (!canBrowseDiscovery(actor)) {
      throw new AppError(
        "AUTH_FORBIDDEN",
        "Discovery is not available in the current account state",
        403,
      );
    }

    const limit = Math.min(query.limit ?? DISCOVER_PEOPLE_DEFAULT_LIMIT, DISCOVER_PEOPLE_MAX_LIMIT);
    const viewerSnapshot = toDiscoverUserSnapshot(viewer);

    if (query.interest) {
      const catalogHit = await this.db.interest.findUnique({
        where: { slug: query.interest },
        select: { id: true },
      });
      if (!catalogHit) {
        throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
      }
    }

    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeDiscoverCursor(query.cursor);
      cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const where = buildDiscoverableUsersWhere(viewerSnapshot, {
      q: query.q,
      city: query.city,
      region: query.region,
      interestSlug: query.interest,
      cursor,
    });

    const rows = await this.db.user.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      select: {
        id: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true,
            username: true,
            avatarStorageKey: true,
            locationCity: true,
            locationRegion: true,
          },
        },
      },
    });

    const page = rows.slice(0, limit);
    const hasMore = rows.length > limit;

    const people = page
      .filter((row) => row.profile !== null)
      .map((row) =>
        toPublicProfilePreview({
          userId: row.id,
          displayName: row.profile!.displayName,
          username: row.profile!.username,
          avatarStorageKey: row.profile!.avatarStorageKey,
          locationCity: row.profile!.locationCity,
          locationRegion: row.profile!.locationRegion,
        }),
      );

    const nextCursor =
      hasMore && page.length > 0
        ? encodeDiscoverCursor({
            createdAt: page[page.length - 1].createdAt.toISOString(),
            id: page[page.length - 1].id,
          })
        : null;

    return { people, nextCursor };
  }
}
