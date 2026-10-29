# Backend remaining work checklist (Task 030)

**Generated:** 2026-10-29 (read-only audit).  
**Use with:** `MASTER_DEFERRED_WORK_QUEUE.md` (authoritative IDs), `TASK_030_BACKEND_COMPLETION_AUDIT_REPORT.md`.

Checklist items reference **MDWQ** where indexed; new ops item **MDWQ-0310** (dev migration drift).

---

## P0 — Admin verification & end-to-end staging

| # | Item | Reuse | Missing / action | Depends on | Owner decision |
|---|---|---|---|---|---|
| P0-1 | **strangeup_dev migrations current** | `npm run db:neon:migrate`, health script | Apply **028C + 028G** on dev catalog | Ops runbook | None — ops |
| P0-2 | **Staff reviewer grant** | `PLATFORM_STAFF_PROVISIONING.md` SQL | Insert `IDENTITY_REVIEWER` for staff user UUID | Staff account exists | None — ops |
| P0-3 | **Staging mock KYC pipeline** | Task 021/022 webhooks + `seedProviderApprovedApplicant` patterns | Env: `KYC_PROVIDER_ENABLED`, mock secret | P0-2 | Mock vs Veriff for staging |
| P0-4 | **Task 031 Admin Panel MVP** | `/v1/admin/identity-reviews/*` | Separate React repo; CORS origin | P0-2, P0-3 | Authorize Task 031 |
| P0-5 | **E2E staging gate** | `auth-flow-e2e.task022d` scenarios | Manual/Playwright duplicate on staging URL | P0-1–4 | — |
| P0-6 | **Meetup invites on dev DB** | 028D–G routes | Dev migration (P0-1) before local meetup testing | P0-1 | Capability LIVE vs DEFERRED (Flutter) |

**Fast test gates (P0):**

- `npm run db:neon:health` → dev **22/22** migrations.
- `RUN_INTEGRATION=1 npx vitest run tests/integration/admin-identity-review.integration.test.ts`
- `RUN_INTEGRATION=1 npx vitest run tests/integration/auth-flow-e2e.task022d.integration.test.ts`
- Admin Panel smoke: login → list PENDING → approve one fixture user → mobile `GET /v1/home` **200**.

---

## P1 — Public release / security / compliance

| # | Item | MDWQ | Reuse | Missing |
|---|---|---|---|---|
| P1-1 | Full Neon integration regression | 0099 | Existing suites | CI job + time budget |
| P1-2 | Production deploy topology & secrets | 0100 | Task 018 fail-closed | Owner deploy auth |
| P1-3 | Counsel consent IDs + strict enforcement | 0101 | Consent registry | Legal ACTIVE versions |
| P1-4 | Production transactional email | 0102, 0204 | Resend adapter | Secrets + activation |
| P1-5 | Production media storage | 0103 | S3 adapter Task 020 | Bucket + env |
| P1-6 | Distributed rate limiting live | 0104 | Redis adapter 019B | Upstash prod |
| P1-7 | Production KYC provider | 0301–0302, 0309 | Verification module | Vendor + Veriff auth |
| P1-8 | Account deletion workflow | 1101 | Impact API | DELETE route + retention policy SET-03 |
| P1-9 | Platform suspend REST + sockets | 0507 | `applyAccountRestrictionSideEffects` | Admin/user writer API |
| P1-10 | FCM push production | 0508 | 023D outbox | Firebase creds, owner |
| P1-11 | Socket Redis adapter (scale-out) | 0509 | Fail-closed flag | Adapter implementation |
| P1-12 | Trust & safety reporting (platform) | 0607 | Group content reports | Product policy + APIs |
| P1-13 | Admin audit history pagination | — | `IdentityAdminReviewDecision` table | `GET …/decisions?cursor=` |
| P1-14 | Admin global user search (optional) | — | Queue list | Search API + audit |
| P1-15 | Socket eviction integration test | — | `onUserLeftGroup` | New Neon case (029H gap) |
| P1-16 | Production email change | 1103 | DEV_ONLY flow | Enable + SET-01 |
| P1-17 | Figma source packaging | 0910 | — | Owner re-export My Groups PDF |

**Fast test gates (P1):** subset per item — e.g. after suspend API: integration test login **403** + socket disconnect; after 0099: single `npm run test:integration` green on `strangeup_test`.

---

## P2 — Optional product improvements

| # | Item | MDWQ |
|---|---|---|
| P2-1 | Geo / distance discovery | 0401 |
| P2-2 | Federated header search | 0405 |
| P2-3 | Activity followers-only publish | 0702 |
| P2-4 | Two-hour activity cutoff | 0703 |
| P2-5 | ACT-NOTIFY (027H skipped) | 0706 |
| P2-6 | Meetup reschedule (028F) | 0724 |
| P2-7 | Jobs tab badge counts | 0906 |
| P2-8 | Group dashboard “+N this wk” | 0915 |
| P2-9 | Saved activities count vs visible | 0718 |
| P2-10 | Admin request-more-info | 022D gap |
| P2-11 | Store catalog prod enablement | 0805 |
| P2-12 | LF/format normalization commit | 0105 |

---

## OWNER_DEFERRED — Not authorized (do not implement)

| Area | MDWQ / decision |
|---|---|
| Checkout, payments, tax, refunds | 0801, 0802, MKT-03 |
| Membership billing / Club purchase | 1001, D-08 |
| OAuth Apple/Google | 0201 |
| Phone OTP signup / verify write | 0202, 0203 |
| Veriff live (until re-authorized) | 0302 |
| E2EE messaging | 0501 |
| D-06 interactive stories/polls LIVE | 0602, 029E skipped |
| Employer job delivery | 0902 |
| Product reviews / Club cart discounts | 0808, 0809 |
| Email marketing notifications | 0514 |
| Task 002B.3B KYC foundation (explicit start) | 0307 |

---

## Recommended execution order (backend + admin)

1. **P0-1** dev migrations (ops).  
2. **P0-2** staff grants (ops).  
3. **Task 031 Phase A–C** (Admin Panel repo — parallel, no backend changes).  
4. **P0-5** staging E2E verification.  
5. Owner chooses: **P1-3/4/7** (release hardening) **or** **D-06 / 029E** (interactive media) **or** **029G jobs** — mutually owner-gated; do not parallelize without scope approval.  
6. **P1-9** suspend API when trust & safety ops ready.  
7. **P1-1** full regression before any production cut.

---

## §5 — Task 031 Admin Panel implementation phases (proposed)

**Prerequisite:** Owner authorizes Task 031 and separate repository.

### Phase 031A — Scaffold & auth (1–2 days)

- Create Vite React TS app; env `VITE_API_BASE_URL`.
- Login page → `POST /v1/auth/login`; persist token.
- Protected route shell; logout clears token.
- **Gate:** reviewer login returns 200; non-reviewer calling admin API returns 403 (manual).

### Phase 031B — Queue & detail (2–3 days)

- Queue page: `GET /v1/admin/identity-reviews?status=PENDING`.
- Cursor pagination UI.
- Detail page: `GET …/:reviewId`; render eligibility dimensions + session + recent decisions.
- **Gate:** Playwright or manual against staging with seeded pending user.

### Phase 031C — Actions & concurrency (1–2 days)

- Approve/reject with `Idempotency-Key` (UUID v4 per click).
- Reason select on reject.
- Handle 409/403 with reload.
- **Gate:** duplicate approve idempotent; concurrent double-click safe.

### Phase 031D — Hardening (optional)

- Approved/Rejected list tabs.
- Request ID logging; session timeout handling.
- CSP, no secrets in frontend bundle.
- **Gate:** security review of token storage choice.

### Phase 031E — Store catalog module (optional, separate from KYC)

- Behind second role; respect `STORE_CATALOG_MANAGEMENT_ENABLED`.
- See `STORE_CATALOG_MANAGEMENT_TASK024B.md`.

**Backend changes in 031:** **None required for MVP** — only CORS/env ops. Future P1 APIs (suspend, search, audit pagination) are **Task 032+** candidates.

---

**STOP:** Task 030 delivered checklist only; implementation requires owner pick of next task.
