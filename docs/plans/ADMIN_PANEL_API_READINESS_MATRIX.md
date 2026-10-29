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
| **Pending KYC/admin-review dashboard** | **YES** | `GET /v1/admin/identity-reviews?status=PENDING&limit=&cursor=` | Queue UI, pagination, empty states | P0 |
| **User list & search (global)** | **NO** | Queue is **status-filtered** applicants only; no `q=` email search | **MISSING** — optional P1: `GET /v1/admin/users?q=` with strict RBAC + audit | P1 |
| **Account verification detail** | **YES** | `GET /v1/admin/identity-reviews/:reviewId` (`reviewId` = `userId`) | Detail page; show session metadata, eligibility dimensions | P0 |
| **Trusted KYC status display** | **YES** | Detail: `identityVerificationStatus`, session `status/provider`, `providerIdentityApprovedAt`, `identityValidUntil`, `identityRevokedAt` | Read-only badges; link to vendor dashboard (external) for doc review | P0 |
| **Current-session binding** | **YES** | Approve requires `identityVerificationSessionId === adminReviewVerificationSessionId` | UI must show **session id** match; explain 409 mismatch after re-verification | P0 |
| **Approve workflow** | **YES** | `POST …/approve` + optional `Idempotency-Key` | Confirm dialog; disable if eligibility fails (403) | P0 |
| **Reject workflow** | **YES** | `POST …/reject` body `{ reasonCode }` enum | Reason picker; idempotency | P0 |
| **Review notes (free text)** | **NO** | Audit stores `reasonCode` on reject only; approve has no note field | **MISSING** — owner policy for PII in notes; optional `reviewNote` on decision row | P2 |
| **Audit history** | **PARTIAL** | Detail includes `recentDecisions[]` (last 10): status, reasonCode, reviewerUserId, sessionId, createdAt | Full paginated history API **MISSING**; UI can show recent 10 only for MVP | P1 |
| **User suspension / revocation** | **NO** | `suspendedAt` on user; login/sockets respect suspension; **no admin REST** | **MISSING** `POST /v1/admin/users/:id/suspend` (+ side effects hook) — MDWQ-0507 | P1 |
| **Post-approval admin reversal** | **NO** | Reject only when `adminReviewStatus=PENDING`; no “revoke activation” admin route | **DECISION_REQUIRED** + new API if product needs re-review without provider revoke | P1 |
| **Request more info** | **NO** | 022D documented deferral | **MISSING** endpoint / applicant notification contract | P2 |
| **Role-based access (RBAC)** | **PARTIAL** | Roles: `IDENTITY_REVIEWER`, `STORE_CATALOG_MANAGER` (separate) | No super-admin UI; grants via SQL | P0 ops |
| **Restricted sensitive identity data** | **YES (by omission)** | No ID/selfie URLs in admin DTOs; masked email only | Panel must **not** expect document images; Veriff SDK/hosted review external | P0 |
| **Concurrent review / errors** | **YES** | `updateMany` conditional → **409**; idempotent replay **200** | UI: toast + reload detail | P0 |
| **Production mock guard** | **YES** | Approve with `KYC_PROVIDER=MOCK` → **403** in production | Staging must use mock; prod panel waits on MDWQ-0302 | P1 |
| **Self-review prevention** | **YES** | Service throws **403** if reviewer id = subject id | Hide own account from queue or disable actions | P0 |
| **Consent / age / email gates on approve** | **YES** | `evaluateApprovalEligibility` — email verified, age ELIGIBLE, consents, trusted KYC | Show blocking reasons on detail (derive from fields + 403 message) | P0 |
| **CORS for browser SPA** | **CONFIG** | Server `CORS_ORIGINS` | Add admin staging origin | P0 |
| **Store catalog ops UI** | **PARTIAL** | `/v1/admin/store-catalog/*` behind `STORE_CATALOG_MANAGER` + feature flag | Separate module in Admin repo; not KYC MVP | P2 |

---

## Existing endpoints (identity review — reuse as-is)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/admin/identity-reviews` | Queue list |
| `GET` | `/v1/admin/identity-reviews/:reviewId` | Detail + recent decisions |
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
4. Applicant pipeline: register → verify email → IDV session → mock webhook APPROVED → appears in PENDING queue.

---

**Last updated:** 2026-10-29 (Task 030 audit)
