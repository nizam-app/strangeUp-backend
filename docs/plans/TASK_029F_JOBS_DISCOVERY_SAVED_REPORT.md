# Task 029F — Jobs discovery, saved jobs & Screen 23 read parity

**Date:** 2026-10-29  
**Scope:** Audit Task 014 jobs read/save paths vs `Screen 23_ Jobs.pdf`; fix confirmed in-scope defects only. **029E interactive group features SKIPPED/DEFERRED** (owner scope). **029G not started.**

**Evidence:** `design-reference/task029-groups-jobs/Screen 23_ Jobs.pdf`, `MANIFEST.md`; Task 014 implementation; `FIGMA_GROUPS_JOBS_PARITY_TASK029A.md` §F; `FIGMA_GROUPS_JOBS_PARITY_TASK029F.md`.

---

## 1. Audit summary (source-backed)

### Discovery — `GET /v1/jobs`

| Requirement | Backend | Status |
|---|---|---|
| Published + open only (`status=PUBLISHED`, `closedAt=null`) | `buildPublishedJobListWhere` + `job.service.listPublished` | **VERIFIED** |
| Text search | `q` → title, description, `companyDisplayName` (case-insensitive) | **VERIFIED** |
| Employment type / work mode | Query enums; invalid → **400** (Zod) | **VERIFIED** |
| City / region (no radius) | `city`, `region` equality filters | **VERIFIED** |
| Sort | `createdAt` desc, tie-break `id` desc | **VERIFIED** |
| Cursor pagination | Opaque cursor; stable keyset | **VERIFIED** (029F regression) |
| Empty catalog | `jobs: []`, valid **200** | **VERIFIED** |
| No fabricated badges/stats | DTO has no featured/partner/applicant/distance | **VERIFIED** (T029F-P01) |
| Task 022 gate | Non-activated → **403** | **VERIFIED** (T029F-P04) |

**No job category model** — Figma “Sports & Fitness” filter remains **MISSING** (do not invent). **MDWQ-0903** geo/radius **DEFERRED**.

### Detail — `GET /v1/jobs/:jobId`

| Requirement | Status |
|---|---|
| Published open only | **404** for draft/closed/other user’s draft |
| Self-reported pay + disclaimer | **VERIFIED** |
| Application window on detail | `applicationStatus` when applicable | **VERIFIED** (T029F-P03) |

### Saved jobs

| Requirement | Status |
|---|---|
| `PUT/DELETE /v1/me/saved-jobs/:jobId` idempotent | **VERIFIED** (T029F-P02) |
| `GET /v1/me/saved-jobs` self only | **VERIFIED** (no cross-user leakage) |
| Closed/unpublished listings omitted from list | **VERIFIED** (T029F-P02) |
| Save auth | Bearer + activation gate | **VERIFIED** |

### Applications navigation (read-only; no 029G lifecycle)

| Figma tab | Backend | Status |
|---|---|---|
| Applications list | `GET /v1/me/job-applications` | **UNCHANGED** — regression T029F-P03 |
| Application detail | `GET /v1/me/job-applications/:applicationId` | **UNCHANGED** |
| Submit apply | `POST /v1/jobs/:id/applications` + consent | **UNCHANGED** |
| Employer delivery / new states | `NOT_CONFIGURED` | **DEFERRED** — **MDWQ-0902**, **0905** |

### Author / publish boundary

- **`POST/PATCH /v1/me/job-listings`:** **DRAFT** only; never listed on `GET /v1/jobs`.
- **No HTTP publish path** — **MDWQ-0901** / **JOB-01** (029G dependency).

### Domain separation

Jobs APIs do not conflate with CommunityMembership, Activity RSVP, MeetupInvite, or Club membership billing.

---

## 2. Defect fixed (029F)

**Issue:** When `GET /v1/jobs` received both `q` and `cursor`, the Prisma `where` object contained two top-level `OR` keys; the cursor clause **overwrote** the search clause, so page-2+ results ignored `q`.

**Fix:** Extract `buildPublishedJobListWhere()` in `src/modules/jobs/job-query.ts` — search and cursor predicates combined under **`AND`**.

**Files:**

- `src/modules/jobs/job-query.ts` (new)
- `src/modules/jobs/job.service.ts` (uses builder)
- `tests/job-query.test.ts` (unit)
- `tests/integration/store-jobs.integration.test.ts` (T029F-P01–P04)

---

## 3. Tests executed

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** |
| `npm test` | **285/285** unit |
| `RUN_INTEGRATION=1 npm run test:integration -- tests/integration/store-jobs.integration.test.ts` | **8/8** on `strangeup_test` |

Full Neon regression deferred per release policy (**MDWQ-0099**).

---

## 4. Phase gates

| Phase | Status |
|---|---|
| **029E** | **SKIPPED/DEFERRED** — interactive group Stories/polls/photo posts; `GROUP_COMMUNITY_INTERACTIVE_ENABLED=false`; queue rows preserved |
| **029F** | **COMPLETE** (this report) |
| **029G** | **NOT STARTED** — owner decisions: **MDWQ-0901** (publish), **0902** (employer delivery), **0905** (application withdrawal/transitions), **0906** (tab badge counts) |

**Still OPEN (unchanged):** **MDWQ-0910** (My Groups PDF packaging), **MDWQ-0911** (Group Details design authority).

---

## 5. Flutter / integration notes

- Screen 23 **Explore / Saved / Applications** tabs map to existing list endpoints; compute tab counts client-side or defer (**MDWQ-0906**).
- Hide or mark deferred UI: radius, “nearby” counts, categories, featured/partner badges, applicant counts, employer progress beyond `NOT_CONFIGURED`.
- **`q` + `cursor`:** safe to combine after 029F fix — see `FIGMA_GROUPS_JOBS_PARITY_TASK029F.md`.

---

**STOP:** Phase 029F complete. Do not implement 029G without owner authorization.
