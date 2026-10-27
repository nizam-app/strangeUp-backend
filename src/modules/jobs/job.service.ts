import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { assertJobsAccess } from "./job-access.js";
import { decodeJobListingCursor, encodeJobListingCursor } from "./job-cursor.js";
import { mapJobDetail, mapJobSummary } from "./job.mapper.js";
import type { JobListQuery } from "./job.validation.js";

function isListingOpen(status: string, closedAt: Date | null): boolean {
  return status === "PUBLISHED" && closedAt === null;
}

export class JobDiscoveryService {
  constructor(private readonly db: DatabaseClient) {}

  async listJobs(user: User, query: JobListQuery) {
    assertJobsAccess(user);
    const limit = query.limit;
    const cursor = query.cursor ? decodeJobListingCursor(query.cursor) : null;

    const rows = await this.db.jobListing.findMany({
      where: {
        status: "PUBLISHED",
        closedAt: null,
        ...(query.employmentType ? { employmentType: query.employmentType } : {}),
        ...(query.workMode ? { workMode: query.workMode } : {}),
        ...(query.city ? { locationCity: { equals: query.city, mode: "insensitive" } } : {}),
        ...(query.region ? { locationRegion: { equals: query.region, mode: "insensitive" } } : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: "insensitive" } },
                { description: { contains: query.q, mode: "insensitive" } },
                { companyDisplayName: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                {
                  createdAt: new Date(cursor.createdAt),
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const page = rows.slice(0, limit);
    const saved = await this.loadSavedSet(
      user.id,
      page.map((j) => j.id),
    );
    const last = page.at(-1);
    const nextCursor =
      rows.length > limit && last
        ? encodeJobListingCursor({
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          })
        : null;

    return {
      jobs: page.map((j) => mapJobSummary(j, saved.has(j.id))),
      nextCursor,
    };
  }

  async getJob(user: User, jobId: string) {
    assertJobsAccess(user);
    const listing = await this.db.jobListing.findFirst({
      where: { id: jobId, status: "PUBLISHED" },
    });
    if (!listing || !isListingOpen(listing.status, listing.closedAt)) {
      throw new AppError("NOT_FOUND", "Job not found", 404);
    }
    const saved = await this.db.savedJob.findUnique({
      where: { userId_jobListingId: { userId: user.id, jobListingId: jobId } },
    });
    return mapJobDetail(listing, saved !== null);
  }

  private async loadSavedSet(userId: string, jobIds: string[]): Promise<Set<string>> {
    if (jobIds.length === 0) {
      return new Set();
    }
    const rows = await this.db.savedJob.findMany({
      where: { userId, jobListingId: { in: jobIds } },
      select: { jobListingId: true },
    });
    return new Set(rows.map((r) => r.jobListingId));
  }
}
