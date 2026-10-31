import { createHash } from "node:crypto";
import type {
  AccountStatus,
  IdentityVerificationStatus,
  Prisma,
  StrangeUpAdminReviewStatus,
} from "../../../generated/prisma/client.js";
import {
  buildSearchWhere,
  decodeListCursor,
  encodeListCursor,
} from "./identity-admin-review-list-query.js";

export type AdminUsersListFilters = {
  q?: string;
  accountStatus?: AccountStatus;
  identityVerificationStatus?: IdentityVerificationStatus;
  adminReviewStatus?: StrangeUpAdminReviewStatus;
};

export { decodeListCursor, encodeListCursor };

export function buildAdminUsersListWhere(filters: AdminUsersListFilters): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [{ deletedAt: null }];

  if (filters.accountStatus) {
    and.push({ accountStatus: filters.accountStatus });
  }
  if (filters.identityVerificationStatus) {
    and.push({ identityVerificationStatus: filters.identityVerificationStatus });
  }
  if (filters.adminReviewStatus) {
    and.push({ adminReviewStatus: filters.adminReviewStatus });
  }

  const search = buildSearchWhere(filters.q);
  if (search) {
    and.push(search);
  }

  return { AND: and };
}

export function buildAdminUsersFilterFingerprint(filters: AdminUsersListFilters): string {
  const payload = JSON.stringify({
    q: filters.q?.trim() ?? "",
    accountStatus: filters.accountStatus ?? "",
    identityVerificationStatus: filters.identityVerificationStatus ?? "",
    adminReviewStatus: filters.adminReviewStatus ?? "",
  });
  return createHash("sha256").update(payload, "utf8").digest("base64url").slice(0, 22);
}
