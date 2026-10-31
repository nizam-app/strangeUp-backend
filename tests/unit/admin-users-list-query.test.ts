import { describe, expect, it } from "vitest";
import {
  buildAdminUsersFilterFingerprint,
  buildAdminUsersListWhere,
} from "../../src/modules/admin/admin-users-list-query.js";

describe("admin-users-list-query", () => {
  it("excludes soft-deleted users by default", () => {
    const where = buildAdminUsersListWhere({});
    expect(where.AND).toEqual(expect.arrayContaining([{ deletedAt: null }]));
  });

  it("applies status filters", () => {
    const where = buildAdminUsersListWhere({
      accountStatus: "ACTIVE",
      identityVerificationStatus: "APPROVED",
      adminReviewStatus: "PENDING",
    });
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { accountStatus: "ACTIVE" },
        { identityVerificationStatus: "APPROVED" },
        { adminReviewStatus: "PENDING" },
      ]),
    );
  });

  it("changes fingerprint when filters change", () => {
    const a = buildAdminUsersFilterFingerprint({ accountStatus: "ACTIVE" });
    const b = buildAdminUsersFilterFingerprint({ accountStatus: "SUSPENDED" });
    expect(a).not.toBe(b);
  });
});
