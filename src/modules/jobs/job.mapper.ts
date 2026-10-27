import type { JobListing } from "../../../generated/prisma/client.js";

export type JobPayDto = {
  minCents: number | null;
  maxCents: number | null;
  currency: string | null;
  period: "HOURLY" | "ANNUAL" | "PER_SESSION" | null;
  disclaimer: string;
};

export type JobListingSummaryDto = {
  jobId: string;
  title: string;
  companyDisplayName: string;
  locationCity: string | null;
  locationRegion: string | null;
  workMode: JobListing["workMode"];
  employmentType: JobListing["employmentType"];
  pay: JobPayDto;
  isSaved: boolean;
  createdAt: string;
};

export type JobListingDetailDto = JobListingSummaryDto & {
  description: string;
  publishedAt: string | null;
  applicationStatus: "OPEN" | "CLOSED";
};

const PAY_DISCLAIMER =
  "Compensation and location labels are self-reported and not verified by StrangeUp.";

export function mapJobPay(listing: JobListing): JobPayDto {
  return {
    minCents: listing.payMinCents,
    maxCents: listing.payMaxCents,
    currency: listing.payCurrency,
    period: listing.payPeriod,
    disclaimer: PAY_DISCLAIMER,
  };
}

export function mapJobSummary(listing: JobListing, isSaved: boolean): JobListingSummaryDto {
  return {
    jobId: listing.id,
    title: listing.title,
    companyDisplayName: listing.companyDisplayName,
    locationCity: listing.locationCity,
    locationRegion: listing.locationRegion,
    workMode: listing.workMode,
    employmentType: listing.employmentType,
    pay: mapJobPay(listing),
    isSaved,
    createdAt: listing.createdAt.toISOString(),
  };
}

export function mapJobDetail(listing: JobListing, isSaved: boolean): JobListingDetailDto {
  const open = listing.status === "PUBLISHED" && listing.closedAt === null;
  return {
    ...mapJobSummary(listing, isSaved),
    description: listing.description,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    applicationStatus: open ? "OPEN" : "CLOSED",
  };
}
