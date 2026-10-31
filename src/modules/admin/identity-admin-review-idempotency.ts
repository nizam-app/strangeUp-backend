import { createHash } from "node:crypto";
import { z } from "zod";
import type { StrangeUpAdminReviewStatus } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";

/** Idempotency-Key header for admin identity review mutations (matches platform convention). */
export const identityAdminReviewClientKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/);

export type IdentityAdminReviewPreparedIdempotency = {
  clientKey: string;
  clientKeyDigest: string;
  payloadFingerprint: string;
  scopedDecisionKey: string;
};

export type IdentityAdminReviewIdempotencyAction =
  "approve" | "reject" | "needs_further_review" | "return_to_pending";

export type IdentityAdminReviewIdempotencyDecisionRow = {
  userId: string;
  status: StrangeUpAdminReviewStatus;
  reasonCode: string | null;
  reviewerUserId: string | null;
  idempotencyKey: string | null;
};

const SCOPED_PREFIX = "identity-admin-review:";
const SCOPED_ACTIONS: IdentityAdminReviewIdempotencyAction[] = [
  "approve",
  "reject",
  "needs_further_review",
  "return_to_pending",
];

export const IDENTITY_ADMIN_REVIEW_IDEMPOTENCY_CONFLICT_MESSAGE =
  "Idempotency key reused with different payload";

export function normalizeOptionalNote(note: string | undefined): string {
  return note?.trim() ?? "";
}

function hashOptionalNoteFingerprint(note: string | undefined): string {
  const normalized = normalizeOptionalNote(note);
  if (!normalized) {
    return "_empty_";
  }
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function scopeIdentityAdminReviewIdempotencyKey(input: {
  reviewerUserId: string;
  reviewId: string;
  action: IdentityAdminReviewIdempotencyAction;
  headerKey: string;
  reasonCode?: string;
  optionalNote?: string;
}): string {
  const trimmed = input.headerKey.trim();
  const parts = [
    "identity-admin-review",
    input.action,
    input.reviewerUserId,
    input.reviewId,
    trimmed,
  ];
  if (input.action === "reject") {
    parts.push(input.reasonCode ?? "");
  }
  if (input.action === "needs_further_review" || input.action === "return_to_pending") {
    parts.push(hashOptionalNoteFingerprint(input.optionalNote));
  }
  return parts.join(":");
}

export function expectedDecisionForAction(
  action: IdentityAdminReviewIdempotencyAction,
  reasonCode?: string,
): { status: StrangeUpAdminReviewStatus; reasonCode: string | null } {
  switch (action) {
    case "approve":
      return { status: "APPROVED", reasonCode: null };
    case "reject":
      return { status: "REJECTED", reasonCode: reasonCode ?? null };
    case "needs_further_review":
      return { status: "NEEDS_FURTHER_REVIEW", reasonCode: null };
    case "return_to_pending":
      return { status: "PENDING", reasonCode: "RETURNED_TO_PENDING" };
  }
}

export function assertIdempotencyDecisionMatchesRequest(
  prior: IdentityAdminReviewIdempotencyDecisionRow,
  input: {
    reviewId: string;
    reviewerUserId: string;
    action: IdentityAdminReviewIdempotencyAction;
    reasonCode?: string;
    headerKey: string;
    optionalNote?: string;
  },
): void {
  if (prior.userId !== input.reviewId || prior.reviewerUserId !== input.reviewerUserId) {
    throw new AppError("CONFLICT", IDENTITY_ADMIN_REVIEW_IDEMPOTENCY_CONFLICT_MESSAGE, 409);
  }

  const expected = expectedDecisionForAction(input.action, input.reasonCode);
  if (prior.status !== expected.status) {
    throw new AppError("CONFLICT", IDENTITY_ADMIN_REVIEW_IDEMPOTENCY_CONFLICT_MESSAGE, 409);
  }
  if (expected.reasonCode !== null && prior.reasonCode !== expected.reasonCode) {
    throw new AppError("CONFLICT", IDENTITY_ADMIN_REVIEW_IDEMPOTENCY_CONFLICT_MESSAGE, 409);
  }

  const scopedKey = scopeIdentityAdminReviewIdempotencyKey({
    reviewerUserId: input.reviewerUserId,
    reviewId: input.reviewId,
    action: input.action,
    headerKey: input.headerKey,
    reasonCode: input.reasonCode,
    optionalNote: input.optionalNote,
  });
  const isLegacyUnscopedRow =
    prior.idempotencyKey !== null &&
    prior.idempotencyKey === input.headerKey.trim() &&
    prior.idempotencyKey !== scopedKey;

  if (
    isLegacyUnscopedRow &&
    (input.action === "needs_further_review" || input.action === "return_to_pending") &&
    normalizeOptionalNote(input.optionalNote) !== ""
  ) {
    throw new AppError("CONFLICT", IDENTITY_ADMIN_REVIEW_IDEMPOTENCY_CONFLICT_MESSAGE, 409);
  }
}

export type ParsedScopedIdentityAdminReviewIdempotencyKey = {
  action: IdentityAdminReviewIdempotencyAction;
  reviewerUserId: string;
  reviewId: string;
  clientHeader: string;
  payloadTail: string | null;
};

/** Parses keys written by `scopeIdentityAdminReviewIdempotencyKey` (client header must not contain `:`). */
export function parseScopedIdentityAdminReviewIdempotencyKey(
  stored: string,
): ParsedScopedIdentityAdminReviewIdempotencyKey | null {
  if (!stored.startsWith(SCOPED_PREFIX)) {
    return null;
  }
  const body = stored.slice(SCOPED_PREFIX.length);
  let action: IdentityAdminReviewIdempotencyAction | null = null;
  let rest: string | null = null;
  for (const candidate of SCOPED_ACTIONS) {
    const prefix = `${candidate}:`;
    if (body.startsWith(prefix)) {
      action = candidate;
      rest = body.slice(prefix.length);
      break;
    }
  }
  if (!action || rest === null) {
    return null;
  }

  const segments = rest.split(":");
  if (segments.length < 3) {
    return null;
  }

  const [reviewerUserId, reviewId, clientHeader, ...tailParts] = segments;
  if (!reviewerUserId || !reviewId || !clientHeader) {
    return null;
  }

  return {
    action,
    reviewerUserId,
    reviewId,
    clientHeader,
    payloadTail: tailParts.length > 0 ? tailParts.join(":") : null,
  };
}

export function assertNoCrossContextClientHeaderReuse(
  existing: IdentityAdminReviewIdempotencyDecisionRow[],
  input: {
    scopedKey: string;
    reviewId: string;
    reviewerUserId: string;
    action: IdentityAdminReviewIdempotencyAction;
    reasonCode?: string;
    optionalNote?: string;
    headerKey: string;
  },
): void {
  const trimmedHeader = input.headerKey.trim();

  for (const row of existing) {
    if (!row.idempotencyKey || row.idempotencyKey === input.scopedKey) {
      continue;
    }

    if (row.idempotencyKey === trimmedHeader) {
      assertIdempotencyDecisionMatchesRequest(row, {
        reviewId: input.reviewId,
        reviewerUserId: input.reviewerUserId,
        action: input.action,
        reasonCode: input.reasonCode,
        headerKey: trimmedHeader,
        optionalNote: input.optionalNote,
      });
      continue;
    }

    const parsed = parseScopedIdentityAdminReviewIdempotencyKey(row.idempotencyKey);
    if (!parsed) {
      continue;
    }
    if (parsed.reviewerUserId !== input.reviewerUserId || parsed.clientHeader !== trimmedHeader) {
      continue;
    }

    throw new AppError("CONFLICT", IDENTITY_ADMIN_REVIEW_IDEMPOTENCY_CONFLICT_MESSAGE, 409);
  }
}

export function resolveStoredIdentityAdminReviewIdempotencyKey(input: {
  reviewerUserId: string;
  reviewId: string;
  action: IdentityAdminReviewIdempotencyAction;
  headerKey: string;
  reasonCode?: string;
  optionalNote?: string;
}): string {
  return scopeIdentityAdminReviewIdempotencyKey(input);
}

export function digestIdentityAdminReviewClientKey(clientKey: string): string {
  return createHash("sha256").update(clientKey, "utf8").digest("hex");
}

export function buildIdentityAdminReviewPayloadFingerprint(input: {
  reviewId: string;
  action: IdentityAdminReviewIdempotencyAction;
  reasonCode?: string;
  optionalNote?: string;
}): string {
  const canonical = JSON.stringify({
    reviewId: input.reviewId,
    action: input.action,
    reasonCode: input.reasonCode ?? null,
    optionalNote: normalizeOptionalNote(input.optionalNote),
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function parseIdentityAdminReviewClientKeyHeader(
  header: string | undefined,
): string | undefined {
  const trimmed = header?.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = identityAdminReviewClientKeySchema.safeParse(trimmed);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid Idempotency-Key header", 400);
  }
  return parsed.data;
}

export function prepareIdentityAdminReviewIdempotency(input: {
  reviewerUserId: string;
  reviewId: string;
  action: IdentityAdminReviewIdempotencyAction;
  clientKey: string;
  reasonCode?: string;
  optionalNote?: string;
}): IdentityAdminReviewPreparedIdempotency {
  const scopedDecisionKey = scopeIdentityAdminReviewIdempotencyKey({
    reviewerUserId: input.reviewerUserId,
    reviewId: input.reviewId,
    action: input.action,
    headerKey: input.clientKey,
    reasonCode: input.reasonCode,
    optionalNote: input.optionalNote,
  });
  return {
    clientKey: input.clientKey,
    clientKeyDigest: digestIdentityAdminReviewClientKey(input.clientKey),
    payloadFingerprint: buildIdentityAdminReviewPayloadFingerprint({
      reviewId: input.reviewId,
      action: input.action,
      reasonCode: input.reasonCode,
      optionalNote: input.optionalNote,
    }),
    scopedDecisionKey,
  };
}
