import { z } from "zod";

export const INTERNAL_NOTE_MIN_LENGTH = 1;
export const INTERNAL_NOTE_MAX_LENGTH = 2000;

export const identityReviewInternalNoteBodySchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(INTERNAL_NOTE_MIN_LENGTH, "Note body is required")
      .max(INTERNAL_NOTE_MAX_LENGTH, `Note must be at most ${INTERNAL_NOTE_MAX_LENGTH} characters`),
  })
  .strict();

export const identityReviewNeedsFurtherReviewBodySchema = z
  .object({
    optionalNote: z
      .string()
      .trim()
      .min(INTERNAL_NOTE_MIN_LENGTH)
      .max(INTERNAL_NOTE_MAX_LENGTH)
      .optional(),
  })
  .strict();

export const identityReviewNotesListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/, "Invalid cursor format")
      .optional(),
  })
  .strict();

export const identityReviewDecisionsListQuerySchema = identityReviewNotesListQuerySchema;
