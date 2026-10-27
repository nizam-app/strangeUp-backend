import { z } from "zod";
import {
  JOB_APPLICATION_CONSENT_VERSION_MAX,
  JOB_COMPANY_NAME_MAX,
  JOB_COVER_MESSAGE_MAX,
  JOB_DESCRIPTION_MAX,
  JOB_LIST_DEFAULT_LIMIT,
  JOB_LIST_MAX_LIMIT,
  JOB_LOCATION_MAX,
  JOB_TITLE_MAX,
} from "./job.constants.js";

const uuidParam = z.string().uuid();

export const jobIdParamSchema = z.object({
  jobId: uuidParam,
});

export const jobApplicationIdParamSchema = z.object({
  applicationId: uuidParam,
});

export const jobListQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "PER_SESSION"]).optional(),
  workMode: z.enum(["ONSITE", "REMOTE", "HYBRID"]).optional(),
  city: z.string().trim().min(1).max(JOB_LOCATION_MAX).optional(),
  region: z.string().trim().min(1).max(JOB_LOCATION_MAX).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(JOB_LIST_MAX_LIMIT).default(JOB_LIST_DEFAULT_LIMIT),
});

export const submitJobApplicationBodySchema = z.object({
  coverMessage: z.string().trim().min(1).max(JOB_COVER_MESSAGE_MAX),
  applicationConsentVersion: z.string().trim().min(1).max(JOB_APPLICATION_CONSENT_VERSION_MAX),
});

export const createJobDraftBodySchema = z.object({
  title: z.string().trim().min(1).max(JOB_TITLE_MAX),
  description: z.string().trim().min(1).max(JOB_DESCRIPTION_MAX),
  companyDisplayName: z.string().trim().min(1).max(JOB_COMPANY_NAME_MAX),
  locationCity: z.string().trim().min(1).max(JOB_LOCATION_MAX).optional(),
  locationRegion: z.string().trim().min(1).max(JOB_LOCATION_MAX).optional(),
  workMode: z.enum(["ONSITE", "REMOTE", "HYBRID"]).optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "PER_SESSION"]),
  payMinCents: z.number().int().min(0).max(999_999_999).optional(),
  payMaxCents: z.number().int().min(0).max(999_999_999).optional(),
  payCurrency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/)
    .optional(),
  payPeriod: z.enum(["HOURLY", "ANNUAL", "PER_SESSION"]).optional(),
});

export const patchJobDraftBodySchema = createJobDraftBodySchema.partial();

export type JobListQuery = z.infer<typeof jobListQuerySchema>;
export type SubmitJobApplicationBody = z.infer<typeof submitJobApplicationBodySchema>;
export type CreateJobDraftBody = z.infer<typeof createJobDraftBodySchema>;
export type PatchJobDraftBody = z.infer<typeof patchJobDraftBodySchema>;
