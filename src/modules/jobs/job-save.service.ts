import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { assertJobsAccess } from "./job-access.js";
import { mapJobSummary } from "./job.mapper.js";

export class JobSaveService {
  constructor(private readonly db: DatabaseClient) {}

  async listSaved(user: User) {
    assertJobsAccess(user);
    const rows = await this.db.savedJob.findMany({
      where: {
        userId: user.id,
        jobListing: { status: "PUBLISHED", closedAt: null },
      },
      include: { jobListing: true },
      orderBy: { createdAt: "desc" },
    });
    return { jobs: rows.map((r) => mapJobSummary(r.jobListing, true)) };
  }

  async saveJob(user: User, jobId: string) {
    assertJobsAccess(user);
    const listing = await this.db.jobListing.findFirst({
      where: { id: jobId, status: "PUBLISHED", closedAt: null },
      select: { id: true },
    });
    if (!listing) {
      throw new AppError("NOT_FOUND", "Job not found", 404);
    }
    await this.db.savedJob.upsert({
      where: { userId_jobListingId: { userId: user.id, jobListingId: jobId } },
      create: { userId: user.id, jobListingId: jobId },
      update: {},
    });
    return { jobId, saved: true };
  }

  async unsaveJob(user: User, jobId: string) {
    assertJobsAccess(user);
    await this.db.savedJob.deleteMany({
      where: { userId: user.id, jobListingId: jobId },
    });
    return { jobId, saved: false };
  }
}
