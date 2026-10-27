import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { assertJobsAccess } from "./job-access.js";
import { decodeJobApplicationCursor, encodeJobApplicationCursor } from "./job-cursor.js";
import { JOB_EMPLOYER_DELIVERY } from "./job.constants.js";
import type { SubmitJobApplicationBody } from "./job.validation.js";

function mapApplication(row: {
  id: string;
  jobListingId: string;
  status: string;
  coverMessage: string;
  applicationConsentVersion: string;
  createdAt: Date;
  updatedAt: Date;
  jobListing: { title: string; companyDisplayName: string; status: string; closedAt: Date | null };
}) {
  return {
    applicationId: row.id,
    jobId: row.jobListingId,
    jobTitle: row.jobListing.title,
    companyDisplayName: row.jobListing.companyDisplayName,
    status: row.status,
    coverMessage: row.coverMessage,
    applicationConsentVersion: row.applicationConsentVersion,
    employerDelivery: JOB_EMPLOYER_DELIVERY,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class JobApplicationService {
  constructor(private readonly db: DatabaseClient) {}

  async submit(user: User, jobId: string, body: SubmitJobApplicationBody) {
    assertJobsAccess(user);

    const listing = await this.db.jobListing.findFirst({
      where: { id: jobId, status: "PUBLISHED", closedAt: null },
      select: { id: true },
    });
    if (!listing) {
      throw new AppError("NOT_FOUND", "Job not found", 404);
    }

    try {
      const created = await this.db.jobApplication.create({
        data: {
          jobListingId: jobId,
          applicantUserId: user.id,
          coverMessage: body.coverMessage,
          applicationConsentVersion: body.applicationConsentVersion,
          status: "SUBMITTED",
        },
        include: {
          jobListing: {
            select: { title: true, companyDisplayName: true, status: true, closedAt: true },
          },
        },
      });
      return mapApplication(created);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        throw new AppError("CONFLICT", "An application for this job already exists", 409);
      }
      throw err;
    }
  }

  async listMine(user: User, query: { cursor?: string; limit: number }) {
    assertJobsAccess(user);
    const limit = query.limit;
    const cursor = query.cursor ? decodeJobApplicationCursor(query.cursor) : null;

    const rows = await this.db.jobApplication.findMany({
      where: {
        applicantUserId: user.id,
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
      include: {
        jobListing: {
          select: { title: true, companyDisplayName: true, status: true, closedAt: true },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor =
      rows.length > limit && last
        ? encodeJobApplicationCursor({
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          })
        : null;

    return {
      applications: page.map(mapApplication),
      nextCursor,
    };
  }

  async getMine(user: User, applicationId: string) {
    assertJobsAccess(user);
    const row = await this.db.jobApplication.findFirst({
      where: { id: applicationId, applicantUserId: user.id },
      include: {
        jobListing: {
          select: { title: true, companyDisplayName: true, status: true, closedAt: true },
        },
      },
    });
    if (!row) {
      throw new AppError("NOT_FOUND", "Application not found", 404);
    }
    return mapApplication(row);
  }
}
