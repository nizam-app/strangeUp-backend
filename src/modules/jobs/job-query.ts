import type { Prisma } from "../../../generated/prisma/client.js";
import type { JobListQuery } from "./job.validation.js";

export function buildPublishedJobListWhere(input: {
  query: JobListQuery;
  cursor: { createdAt: string; id: string } | null;
}): Prisma.JobListingWhereInput {
  const and: Prisma.JobListingWhereInput[] = [];

  if (input.query.q) {
    and.push({
      OR: [
        { title: { contains: input.query.q, mode: "insensitive" } },
        { description: { contains: input.query.q, mode: "insensitive" } },
        { companyDisplayName: { contains: input.query.q, mode: "insensitive" } },
      ],
    });
  }

  if (input.cursor) {
    and.push({
      OR: [
        { createdAt: { lt: new Date(input.cursor.createdAt) } },
        {
          createdAt: new Date(input.cursor.createdAt),
          id: { lt: input.cursor.id },
        },
      ],
    });
  }

  return {
    status: "PUBLISHED",
    closedAt: null,
    ...(input.query.employmentType ? { employmentType: input.query.employmentType } : {}),
    ...(input.query.workMode ? { workMode: input.query.workMode } : {}),
    ...(input.query.city
      ? { locationCity: { equals: input.query.city, mode: "insensitive" } }
      : {}),
    ...(input.query.region
      ? { locationRegion: { equals: input.query.region, mode: "insensitive" } }
      : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };
}
