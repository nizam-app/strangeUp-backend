# Admin Panel API readiness matrix (Task 030)

**Scope:** Task 022 identity admin review + platform staff model. **Store catalog admin (024B)** noted separately — not required for KYC MVP panel.

**Backend prefix:** `/v1/admin` (mounted in `src/app.ts`).  
**OpenAPI:** `openapi/admin.yaml` (identity + partial store catalog).  
**Provisioning:** `docs/operations/PLATFORM_STAFF_PROVISIONING.md`.

**Rule:** Admin Panel actions must use existing approve/reject paths — **never** PATCH user KYC fields directly or call internal services that skip `IdentityAdminReviewService` eligibility.

---

## Capability matrix

| Admin Panel need | Backend today | API / mechanism | Gap for UI | Priority |
|---|---|---|---|---|
| **Secure admin authentication** | **YES** | Same as mobile: `POST /v1/auth/login` → Bearer access token | Admin SPA token storage (httpOnly cookie or secure memory); short TTL refresh | P0 |
| **Admin authorization (role)** | **YES** | `PlatformStaffGrant` role `IDENTITY_REVIEWER`; middleware `require-identity-reviewer` | Ops SQL grant before first login; 403 UX | P0 |
| **Pending KYC/admin-review dashboard** | **PARTIAL** | 031E-1 list/summary live; **031F-1** hold/notes routes **blocked on migration** | Queue posture + internal notes UI (031F-2) | P0 |
| **User list & search (global)** | **YES (032A/032E)** | `GET /v1/admin/users` + summary; masked email/phone; name/email-prefix/user-ID search | Admin Users List live on sandbox `:5174` | P1 done |
| **Account verification detail** | **YES** | `GET /v1/admin/identity-reviews/:reviewId` (`reviewId` = `userId`) | Detail page; show session metadata, eligibility dimensions | P0 |
| **Trusted KYC status display** | **YES** | Detail: `identityVerificationStatus`, session `status/provider`, `providerIdentityApprovedAt`, `identityValidUntil`, `identityRevokedAt` | Read-only badges; link to vendor dashboard (external) for doc review | P0 |
| **Current-session binding** | **YES** | Approve requires `identityVerificationSessionId === adminReviewVerificationSessionId` | UI must show **session id** match; explain 409 mismatch after re-verification | P0 |
| **Approve workflow** | **YES** | `POST …/approve` + optional `Idempotency-Key` | Confirm dialog; disable if eligibility fails (403) | P0 |
| **Reject workflow** | **YES** | `POST …/reject` body `{ reasonCode }` enum | Reason picker; idempotency | P0 |
| **Review notes (free text)** | **PARTIAL (031F-1 backend)** | `IdentityAdminReviewInternalNote` + GET/POST `…/notes` after migration | Admin UI timeline (031F-2); redaction route deferred (retention policy) | P1 |
| **Audit history** | **PARTIAL** | Detail includes `recentDecisions[]` (last 10): status, reasonCode, reviewerUserId, sessionId, createdAt | Full paginated history API **MISSING**; UI can show recent 10 only for MVP | P1 |
| **User suspension / revocation** | **YES (032C–032E)** | `POST /v1/admin/users/:id/suspend` + `/restore`; `AccountModerationDecision`; in-tx session/device revoke; post-commit `applyAccountRestrictionSideEffects` | Admin User Details Suspend/Restore UI; SUPER_ADMIN only | P1 done |
| **Post-approval admin reversal** | **NO** | Reject only when `adminReviewStatus=PENDING`; no “revoke activation” admin route | **DECISION_REQUIRED** + new API if product needs re-review without provider revoke | P1 |
| **Needs further review (internal hold)** | **PARTIAL (031F-1 backend)** | `NEEDS_FURTHER_REVIEW` + POST hold/return after migration | Distinct from applicant `NEEDS_MORE_INFO` / request-more-info (deferred) | P0 |
| **Request more info (applicant-facing)** | **NO** | 022D documented deferral; `NEEDS_MORE_INFO` reserved | **MISSING** endpoint / applicant notification contract | P2 |
| **Role-based access (RBAC)** | **PARTIAL** | Roles: `IDENTITY_REVIEWER`, `STORE_CATALOG_MANAGER` (separate) | No super-admin UI; grants via SQL | P0 ops |
| **Restricted sensitive identity data** | **YES (by omission)** | No ID/selfie URLs in admin DTOs; masked email only | Panel must **not** expect document images; Veriff SDK/hosted review external | P0 |
| **Concurrent review / errors** | **YES** | `updateMany` conditional → **409**; idempotent replay **200** | UI: toast + reload detail | P0 |
| **Production mock guard** | **YES** | Approve with `KYC_PROVIDER=MOCK` → **403** in production | Staging must use mock; prod panel waits on MDWQ-0302 | P1 |
| **Self-review prevention** | **YES** | Service throws **403** if reviewer id = subject id | Hide own account from queue or disable actions | P0 |
| **Consent / age gates on approve** | **YES** | `evaluateApprovalEligibility` — age ELIGIBLE, consents, trusted KYC (`emailVerified` informational only — Task 031B.2) | Show blocking reasons on detail (derive from fields + 403 message) | P0 |
| **CORS for browser SPA** | **CONFIG** | Server `CORS_ORIGINS` | Add admin staging origin | P0 |
| **Store catalog ops UI** | **PARTIAL** | `/v1/admin/store-catalog/*` behind `STORE_CATALOG_MANAGER` + feature flag | Separate module in Admin repo; not KYC MVP | P2 |

---

## Existing endpoints (identity review — reuse as-is)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/admin/identity-reviews/summary` | Global totals incl. pendingActionable / pendingOnHold (031F-1) |
| `GET` | `/v1/admin/identity-reviews` | Queue list (posture + 031E-1 filters) |
| `POST` | `/v1/admin/identity-reviews/:reviewId/needs-further-review` | Internal hold (031F-1) |
| `POST` | `/v1/admin/identity-reviews/:reviewId/return-to-pending` | Release hold (031F-1) |
| `GET/POST` | `/v1/admin/identity-reviews/:reviewId/notes` | Staff notes (031F-1) |
| `GET` | `/v1/admin/identity-reviews/:reviewId/decisions` | Paginated decision audit history |
| `GET` | `/v1/admin/identity-reviews/:reviewId` | Detail + recent decisions (compat preview) |
| `POST` | `/v1/admin/identity-reviews/:reviewId/approve` | Activation approve |
| `POST` | `/v1/admin/identity-reviews/:reviewId/reject` | Activation reject |

**Not gated by Task 022 home access** — uses Bearer + staff role only (`CURRENT_APIS.md`).

---

## Reject reason codes (UI enum)

From `admin-review-reason-codes` / OpenAPI:

- `POLICY_INELIGIBLE`
- `IDENTITY_MISMATCH`
- `INSUFFICIENT_EVIDENCE`
- `FRAUD_SUSPECTED`
- `OTHER_ADMIN_DECISION`

---

## Test gates (backend — already exist)

| Suite | File |
|---|---|
| Admin identity integration | `tests/integration/admin-identity-review.integration.test.ts` |
| Auth E2E (includes admin path) | `tests/integration/auth-flow-e2e.task022d.integration.test.ts` |

Admin Panel E2E (Task 031): Playwright against staging — login as granted reviewer → list PENDING → open detail → approve/reject with mock applicant fixture.

---

## Minimal React + TypeScript Admin Panel (recommended)

| Aspect | Recommendation |
|---|---|
| **Repo** | New workspace e.g. `strangeup-admin` (not in Flutter repo) |
| **Stack** | Vite + React 18 + TypeScript; TanStack Query for API; React Router |
| **Auth** | Login page → store access token (prefer BFF or httpOnly cookie pattern for production) |
| **API client** | Typed fetch wrapper; base URL from env; attach `Authorization: Bearer` |
| **Pages (MVP)** | Login → Queue (PENDING) → Review detail → Approve/Reject |
| **Deploy** | Private static host + API CORS; no embedded Firebase/secrets |
| **Phase 2** | Approved/Rejected tabs; audit expansion; suspend (when API exists) |
| **Phase 3** | Store catalog module (024B) for merchandising ops |

---

## Dependencies before Admin Panel go-live

1. At least one **`IDENTITY_REVIEWER`** grant on staging.
2. **`KYC_PROVIDER_ENABLED=true`** (mock) + webhook secret for demo applicants **or** real vendor when authorized.
3. **`CONSENT_ENFORCEMENT`** aligned with test/staging (placeholder vs strict).
4. Applicant pipeline: register → login → IDV session → mock webhook APPROVED → appears in PENDING queue (email verify optional).

---

## Users Management endpoints (Tasks 032A–032E)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/admin/users/summary` | Global non-deleted totals |
| `GET` | `/v1/admin/users` | Directory list |
| `GET` | `/v1/admin/users/:userId` | Detail + moderation capabilities |
| `POST` | `/v1/admin/users/:userId/suspend` | SUPER_ADMIN suspend + session/socket revocation |
| `POST` | `/v1/admin/users/:userId/restore` | SUPER_ADMIN restore prior status |

**Sandbox (032E):** verified on `strangeup_test` (27/27) via `:3010` / `:3011` / `:5174`. Temporary SUPER_ADMIN grant cleaned up.

**Production/dev rollout:** owner must apply `20261031120000_task032c_account_moderation_decision` to `strangeup_dev` and production before enabling writers there. Provision `SUPER_ADMIN` via `PlatformStaffGrant` (not client flags).

## Activities directory endpoints (Task 033A / 033B)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/admin/activities/summary` | Lifecycle totals, published schedule windows, category/city catalogs |
| `GET` | `/v1/admin/activities` | Directory list (search / filters / cursor / `totalMatching`) |
| `GET` | `/v1/admin/activities/export` | Privacy-safe CSV export |
| `GET` | `/v1/admin/activities/:activityId` | Read-only detail |
| `GET` | `/v1/admin/activities/:activityId/cover` | Staff cover bytes |

Read-only. Same `IDENTITY_REVIEWER` / `SUPER_ADMIN` gate as Users list. No create/approve/suspend/cancel/delete APIs.

**Sandbox (033C):** synthetic seed on `strangeup_test` only (36 activities). List/summary/detail/CSV verified via `:3010` / `:5174` with existing `IDENTITY_REVIEWER` access.

**Last updated:** 2026-10-31 (Task 033C)
