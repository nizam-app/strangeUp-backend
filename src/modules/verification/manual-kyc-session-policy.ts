import type { User, VerificationSession } from "../../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";

export function assertManualSessionOwnedAndCurrent(input: {
  user: Pick<User, "id" | "identityVerificationSessionId" | "identityVerificationRevokedAt">;
  session: Pick<VerificationSession, "id" | "userId" | "provider" | "sessionExpiresAt" | "status">;
}): void {
  if (input.session.userId !== input.user.id) {
    throw new AppError("NOT_FOUND", "Manual verification session not found", 404);
  }
  if (input.session.provider !== "MANUAL") {
    throw new AppError("CONFLICT", "Session is not a manual verification session", 409);
  }
  if (input.user.identityVerificationRevokedAt) {
    throw new AppError("AUTH_FORBIDDEN", "Identity verification is revoked", 403);
  }
  if (
    input.user.identityVerificationSessionId &&
    input.user.identityVerificationSessionId !== input.session.id
  ) {
    throw new AppError(
      "CONFLICT",
      "This verification session is no longer active for your account",
      409,
    );
  }
  if (input.session.sessionExpiresAt.getTime() <= Date.now()) {
    throw new AppError("CONFLICT", "Manual verification session has expired", 409);
  }
}

export const MANUAL_EVIDENCE_UPLOAD_STATUSES = ["PENDING_USER", "RESUBMISSION_REQUESTED"] as const;
