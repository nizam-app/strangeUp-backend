# Platform staff provisioning (Task 022B)

## Identity reviewers

StrangeUp **identity admin review** APIs require an active `PlatformStaffGrant` with role `IDENTITY_REVIEWER`. Grants are stored server-side; client apps cannot assign roles.

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
