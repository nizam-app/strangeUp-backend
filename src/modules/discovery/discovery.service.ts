import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { AppEnv } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { toPolicyActor } from "../policy/account-policy.js";
import { canBrowseDiscovery, toDiscoverUserSnapshot } from "../policy/public-profile-policy.js";
import type { KycEnforcementContext } from "../verification/kyc-trust.js";
import { buildKycEnforcementContext } from "../verification/kyc-identity-authority.js";
import { buildDiscoverableUsersWhere } from "./discover-query.js";
import { isRowDiscoverableTarget } from "./discover-target-policy.js";
import { DISCOVER_PEOPLE_DEFAULT_LIMIT, DISCOVER_PEOPLE_MAX_LIMIT } from "./discovery.constants.js";
import { decodeDiscoverCursor, encodeDiscoverCursor } from "./discovery-cursor.js";
import type { discoverPeopleQuerySchema } from "./discovery.validation.js";
import { toPublicProfilePreview } from "./public-profile.dto.js";
import type { z } from "zod";

const DISCOVER_LIST_USER_SELECT = {
  id: true,
  createdAt: true,
  accountStatus: true,
  emailVerifiedAt: true,
  ageEligibilityStatus: true,
  suspendedAt: true,
  deletedAt: true,
  identityVerificationStatus: true,
  identityVerificationApprovedAt: true,
  identityVerificationValidUntil: true,
  identityVerificationRevokedAt: true,
  identityVerificationSessionId: true,
  adminReviewStatus: true,
  adminReviewVerificationSessionId: true,
  profile: {
    select: {
      displayName: true,
      username: true,
      avatarStorageKey: true,
      locationCity: true,
      locationRegion: true,
    },
  },
} as const;

/** Max rows scanned per request when policy filters rows after the DB pre-filter. */
const DISCOVER_SCAN_BATCH = 40;
const DISCOVER_SCAN_MAX_BATCHES = 8;

export class DiscoveryService {
  constructor(
    private readonly db: DatabaseClient,
    private readonly env: AppEnv,
  ) {}

  private kycContext(): KycEnforcementContext {
    return buildKycEnforcementContext(this.env);
  }

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
    const kycCtx = this.kycContext();
    const now = new Date();

    if (query.interest) {
      const catalogHit = await this.db.interest.findUnique({
        where: { slug: query.interest },
        select: { id: true },
      });
      if (!catalogHit) {
        throw new AppError("VALIDATION_ERROR", "Request validation failed", 400);
      }
    }

    let scanCursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      const decoded = decodeDiscoverCursor(query.cursor);
      scanCursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
    }

    const matched: Array<{
      createdAt: Date;
      id: string;
      preview: ReturnType<typeof toPublicProfilePreview>;
    }> = [];

    for (let batch = 0; batch < DISCOVER_SCAN_MAX_BATCHES && matched.length <= limit; batch++) {
      const where = buildDiscoverableUsersWhere(
        viewerSnapshot,
        {
          q: query.q,
          city: query.city,
          region: query.region,
          interestSlug: query.interest,
          cursor: scanCursor,
        },
        now,
      );

      const rows = await this.db.user.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: DISCOVER_SCAN_BATCH,
        select: DISCOVER_LIST_USER_SELECT,
      });

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        if (!row.profile) {
          continue;
        }
        const snapshot = toDiscoverUserSnapshot(row);
        if (!isRowDiscoverableTarget(snapshot, kycCtx, now)) {
          continue;
        }
        matched.push({
          createdAt: row.createdAt,
          id: row.id,
          preview: toPublicProfilePreview({
            userId: row.id,
            displayName: row.profile.displayName,
            username: row.profile.username,
            avatarStorageKey: row.profile.avatarStorageKey,
            locationCity: row.profile.locationCity,
            locationRegion: row.profile.locationRegion,
          }),
        });
        if (matched.length > limit) {
          break;
        }
      }

      const lastScanned = rows[rows.length - 1];
      scanCursor = { createdAt: lastScanned.createdAt, id: lastScanned.id };

      if (rows.length < DISCOVER_SCAN_BATCH) {
        break;
      }
    }

    const hasMore = matched.length > limit;
    const page = matched.slice(0, limit);

    const nextCursor =
      hasMore && page.length > 0
        ? encodeDiscoverCursor({
            createdAt: page[page.length - 1].createdAt.toISOString(),
            id: page[page.length - 1].id,
          })
        : null;

    return { people: page.map((row) => row.preview), nextCursor };
  }
}
