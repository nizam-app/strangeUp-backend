# Platform staff provisioning (Task 022B)

## Super admin (owner-facing)

The Admin Panel uses a single owner-facing **`SUPER_ADMIN`** grant for local/staging operators who need all **implemented** staff-gated admin APIs (identity review, store catalog when feature-flagged, etc.). Middleware still enforces authentication, audit paths, and product feature flags — `SUPER_ADMIN` does not bypass KYC/home gates for customer accounts.

```sql
INSERT INTO "PlatformStaffGrant" ("id", "userId", "role", "grantedAt")
VALUES (gen_random_uuid(), '<staff-user-uuid>', 'SUPER_ADMIN', NOW())
ON CONFLICT ("userId", "role") DO UPDATE SET "revokedAt" = NULL, "grantedAt" = NOW();
```

Non-production optional env: `PLATFORM_SUPER_ADMIN_USER_IDS` (comma-separated user UUIDs) with `syncPlatformStaffBootstrapGrants()` — **must not** be set in production.

## Identity reviewers

StrangeUp **identity admin review** APIs require an active `PlatformStaffGrant` with role `IDENTITY_REVIEWER`, or **`SUPER_ADMIN`**. Grants are stored server-side; client apps cannot assign roles.

### Production (required process)

1. Create or identify the staff member’s normal StrangeUp user account (email/password auth — no separate admin signup route).
2. Insert or update a grant using a controlled ops channel (SQL migration script, break-glass runbook, or future internal tooling — **not** a public HTTP bootstrap):

```sql
INSERT INTO "PlatformStaffGrant" ("id", "userId", "role", "grantedAt")
VALUES (gen_random_uuid(), '<staff-user-uuid>', 'IDENTITY_REVIEWER', NOW())
ON CONFLICT ("userId", "role") DO UPDATE SET "revokedAt" = NULL, "grantedAt" = NOW();
```

3. Revoke by setting `revokedAt` — do not delete audit history on `IdentityAdminReviewDecision`.

`PLATFORM_IDENTITY_REVIEWER_USER_IDS` **must not** be set in production (`production-env-policy` fails closed).

### Non-production / isolated Neon test

- Integration tests call `upsertStaffGrant()` directly.
- Optional env `PLATFORM_IDENTITY_REVIEWER_USER_IDS` (comma-separated user UUIDs) may be used with `syncPlatformStaffBootstrapGrants()` in local tooling; not wired to HTTP.

### Security notes

- Reviewers authenticate with the same Bearer session as mobile users; authorization is enforced in middleware **and** service layers.
- Self-review of own identity is forbidden.
- Mock KYC provider cannot be used to approve identities when `NODE_ENV=production`.

---

## Store catalog managers (Task 024B)

Merchandise **catalog CRUD and image ingest** require role **`STORE_CATALOG_MANAGER`**, or **`SUPER_ADMIN`**. This is **independent** of `IDENTITY_REVIEWER` (unless consolidated via super admin).

See `docs/operations/STORE_CATALOG_MANAGEMENT_TASK024B.md` for API list, `STORE_CATALOG_MANAGEMENT_ENABLED` gate, and S3 migration notes.

```sql
INSERT INTO "PlatformStaffGrant" ("id", "userId", "role", "grantedAt")
VALUES (gen_random_uuid(), '<staff-user-uuid>', 'STORE_CATALOG_MANAGER', NOW())
ON CONFLICT ("userId", "role") DO UPDATE SET "revokedAt" = NULL, "grantedAt" = NOW();
```
