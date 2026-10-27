import type { User } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type { DatabaseClient } from "../../infrastructure/database/prisma.js";
import { assertJobsAccess } from "./job-access.js";
import type { CreateJobDraftBody, PatchJobDraftBody } from "./job.validation.js";

function validatePay(body: {
  payMinCents?: number;
  payMaxCents?: number;
  payCurrency?: string;
  payPeriod?: string;
}): void {
  const hasPay =
    body.payMinCents !== undefined ||
    body.payMaxCents !== undefined ||
    body.payCurrency !== undefined ||
    body.payPeriod !== undefined;
  if (!hasPay) {
    return;
  }
  if (body.payCurrency === undefined) {
    throw new AppError("VALIDATION_ERROR", "payCurrency is required when pay fields are set", 400);
  }
  if (body.payMinCents !== undefined && body.payMaxCents !== undefined) {
    if (body.payMaxCents < body.payMinCents) {
      throw new AppError("VALIDATION_ERROR", "payMaxCents must be >= payMinCents", 400);
    }
  }
}

function mapDraft(row: {
  id: string;
  title: string;
  description: string;
  companyDisplayName: string;
  locationCity: string | null;
  locationRegion: string | null;
  workMode: string | null;
  employmentType: string;
  payMinCents: number | null;
  payMaxCents: number | null;
  payCurrency: string | null;
  payPeriod: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    jobId: row.id,
    status: row.status,
    publishingStatus: "DRAFT_ONLY" as const,
    publishingMessage:
      "Draft listings are not public. Trusted publisher approval is required before jobs appear in search.",
    title: row.title,
    description: row.description,
    companyDisplayName: row.companyDisplayName,
    locationCity: row.locationCity,
    locationRegion: row.locationRegion,
    workMode: row.workMode,
    employmentType: row.employmentType,
    payMinCents: row.payMinCents,
    payMaxCents: row.payMaxCents,
    payCurrency: row.payCurrency,
    payPeriod: row.payPeriod,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class JobDraftService {
  constructor(private readonly db: DatabaseClient) {}

  async createDraft(user: User, body: CreateJobDraftBody) {
    assertJobsAccess(user);
    validatePay(body);

    const created = await this.db.jobListing.create({
      data: {
        authorUserId: user.id,
        title: body.title,
        description: body.description,
        companyDisplayName: body.companyDisplayName,
        locationCity: body.locationCity ?? null,
        locationRegion: body.locationRegion ?? null,
        workMode: body.workMode ?? null,
        employmentType: body.employmentType,
        payMinCents: body.payMinCents ?? null,
        payMaxCents: body.payMaxCents ?? null,
        payCurrency: body.payCurrency ?? null,
        payPeriod: body.payPeriod ?? null,
        status: "DRAFT",
      },
    });
    return mapDraft(created);
  }

  async listDrafts(user: User) {
    assertJobsAccess(user);
    const rows = await this.db.jobListing.findMany({
      where: { authorUserId: user.id, status: "DRAFT" },
      orderBy: { updatedAt: "desc" },
    });
    return { drafts: rows.map(mapDraft) };
  }

  async getDraft(user: User, jobId: string) {
    assertJobsAccess(user);
    const row = await this.db.jobListing.findFirst({
      where: { id: jobId, authorUserId: user.id, status: "DRAFT" },
    });
    if (!row) {
      throw new AppError("NOT_FOUND", "Draft not found", 404);
    }
    return mapDraft(row);
  }

  async patchDraft(user: User, jobId: string, body: PatchJobDraftBody) {
    assertJobsAccess(user);
    validatePay(body);

    const existing = await this.db.jobListing.findFirst({
      where: { id: jobId, authorUserId: user.id, status: "DRAFT" },
    });
    if (!existing) {
      throw new AppError("NOT_FOUND", "Draft not found", 404);
    }

    const updated = await this.db.jobListing.update({
      where: { id: jobId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.companyDisplayName !== undefined
          ? { companyDisplayName: body.companyDisplayName }
          : {}),
        ...(body.locationCity !== undefined ? { locationCity: body.locationCity ?? null } : {}),
        ...(body.locationRegion !== undefined
          ? { locationRegion: body.locationRegion ?? null }
          : {}),
        ...(body.workMode !== undefined ? { workMode: body.workMode ?? null } : {}),
        ...(body.employmentType !== undefined ? { employmentType: body.employmentType } : {}),
        ...(body.payMinCents !== undefined ? { payMinCents: body.payMinCents ?? null } : {}),
        ...(body.payMaxCents !== undefined ? { payMaxCents: body.payMaxCents ?? null } : {}),
        ...(body.payCurrency !== undefined ? { payCurrency: body.payCurrency ?? null } : {}),
        ...(body.payPeriod !== undefined ? { payPeriod: body.payPeriod ?? null } : {}),
      },
    });
    return mapDraft(updated);
  }
}
