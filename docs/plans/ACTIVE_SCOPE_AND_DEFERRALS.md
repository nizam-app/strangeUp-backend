# StrangeUp — Active Scope, Deferrals & Design Evidence Tracker

**Updated:** 2026-10-29 (Task **030** audit complete — **031** Admin Panel proposed; Task **029** closed within scope; billing still deferred)  
**Target market:** United States | **Minimum age:** 18+ | **Primary currency:** USD  

**Team boundary:** This repository is **backend only**. Flutter lives in a separate repo; publish contracts via `CURRENT_APIS.md` and `FLUTTER_DEVELOPER_HANDOFF.md` — do not implement mobile UI here.

## 1. Source-of-truth & operating rules

**Deferred-work index:** `docs/plans/MASTER_DEFERRED_WORK_QUEUE.md` is the single authoritative register of deferred, partial, owner-blocked, and release-blocking items across Tasks 001–026A. Update it whenever this tracker or task scope changes.

1. **Build the Figma-described backend for each flow.** For each vertical slice: design-screen evidence → flow and acceptance criteria → schema/policies → routes → tests → API handoff for the external Flutter developer. **Task 027** after-membership activities: **closed** per `TASK_027I_FINAL_VERIFICATION_REPORT.md` (027G/H skipped; not full Figma parity).
2. Existing approved product decisions, architecture decisions, and source code take precedence over assumptions in this tracker. Flag conflicts; do not silently overwrite approvals.
3. The repository and executed tests establish implementation status. **Reports are evidence summaries, not a substitute for inspecting source.** Never call proposed APIs LIVE.
4. **Design evidence:** `design-reference/` holds **13 focus PDFs** (onboarding, auth, edit profile, settings hub, public profile, discovery) plus **Task 027** package `design-reference/task027-activities-post-membership/` (5 PDFs — Activity Details, My Activities, Create Activity, Join Requests, section title). Manifest: same folder `MANIFEST.md`. Parity (closure): `docs/product/FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027I_FINAL.md` (027A matrix remains historical). Profile ZIP manifest: `docs/source/FIGMA_EXPORT_VERIFICATION_2026-10-26.md`; profile parity: `docs/product/FIGMA_PROFILE_PARITY_MATRIX_2026-10-26.md`.
5. When adding/changing any API, synchronize `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`, relevant OpenAPI, tests, and `docs/plans/STATUS.md`.
6. Keep this tracker short and update it **within each feature task**.
7. Do not commit, push, deploy, or change production without explicit authorization.

## 2. Current implementation — verified baseline (Task 003)

| Feature | Status | Qualification |
|---|---|---|
| Express/TypeScript/Prisma foundation | **IMPLEMENTED** | Neon PostgreSQL (`strangeup_dev` / `strangeup_test`); native/Prisma Dev URLs preserved as fallback |
| Email/password auth, sessions, verification, password reset | **IMPLEMENTED** | Dev email stub only |
| `GET /v1/me/account`, `GET/PATCH /v1/me/profile` | **IMPLEMENTED** | Includes optional `username`; bio write max **300**; pending cannot PATCH; suspended cannot read `/v1/me/*` |
| `GET /v1/interests`, `GET/PUT /v1/me/interests` | **IMPLEMENTED** | 10-option catalog; private selections; PUT gated like profile PATCH |
| Task 008 / 008A — favorites, visibility/location, avatar | **IMPLEMENTED** | Self-only APIs; owner policy **APPROVED** (`D-OWN-PROFILE-REMAINING-REQUEST-task008.md`); visibility default **VERIFIED_USERS_ONLY**; avatar byte validation; native section verify **pending** credentials |
| `POST /v1/me/password-change` | **VERIFIED** | Task 005 slice 1 closed 2026-10-27; integration T005 **6/6** + full suite **30 passed**, 1 skipped |
| Figma profile parity (safe fields) | **VERIFIED** | Unit + Neon `strangeup_test` integration |
| KYC enforcement APIs | **PARTIAL** | Activity publish/confirm/meeting enforced (Task 010); Task 021 sessions + mock webhook; **Veriff live BLOCKED BY OWNER** (KYC-02) |

## 3. Active next development scope (backend repo)

| Order | Slice | Notes |
|---|---|---|
| **DONE** | **Integration verification gate** | Neon `strangeup_test`; regression includes Tasks 006–015 after closure run |
| **COMPLETE (audit)** | **Task 030 — backend completion & Admin readiness** | Reports in `docs/plans/TASK_030_*`, `ADMIN_PANEL_API_READINESS_MATRIX.md`, `BACKEND_REMAINING_WORK_CHECKLIST.md`; **no implementation** |
| **NEXT (owner-gated)** | **Task 031 — React Admin Panel (separate repo)** | Reuse Task 022B `/v1/admin/identity-reviews/*`; see checklist §5 |
| **COMPLETE (approved scope)** | **Groups & Jobs flow audit (Task 029A–H)** | 029B–D + 029F verified on Neon; **029E/029G SKIPPED** (queue open); parity `FIGMA_GROUPS_JOBS_PARITY_TASK029H_FINAL.md` — **not** full Figma / not prod-ready |
| **IMPLEMENTED** | **Store catalog, cart, favorites & jobs (Task 014; 029F Screen 23 read)** | Screens 20–23; checkout/payment/employer delivery **DEFERRED** (MKT-03, JOB-02); job publish **MDWQ-0901**; no HTTP publish path |
| **VERIFIED (Neon)** | **Home dashboard, feed & notifications (Task 013)** | Screen 08 + Notification.pdf; stories still deferred |
| **VERIFIED (Neon)** | **Groups & Communities (Task 012)** | Screens 14/15/1/2 LIVE |
| **IMPLEMENTED (disabled)** | **Group stories, photo posts & polls (Task 016)** | Routes + schema behind `GROUP_COMMUNITY_INTERACTIVE_ENABLED=false`; Home stories **DEFERRED**; D-06 owner gate |
| **VERIFIED (Neon)** | **Social / Activities / Discovery (Tasks 009–011)** | Included in regression suite |
| **VERIFIED (Neon)** | **Settings hub & account lifecycle (Task 015)** | Screen 26 overview, saved activities, sessions, email change DEV_ONLY; deletion impact only — **destructive delete DEFERRED** (SET-03) |
| **IMPLEMENTED** | **Membership plans & entitlements (Task 017 / 026A)** | Screen 18 read-only catalog + **`flow`** contract; **owner deferred all billing**; **no DB migration**; Club **not purchasable**; settings overview `membership` summary |
| **IMPLEMENTED** | **Release hardening phase 1 (Task 018)** | Production env fail-closed; format drift diagnosis; LF `.gitattributes` — **not** production-ready alone |
| **IMPLEMENTED** | **Auth email & distributed abuse protection (Tasks 019 / 019B)** | Resend + Upstash Redis adapters; default remains dev_stub/memory; **live production activation** requires deploy secrets + explicit deploy authorization |
| **IMPLEMENTED** | **Production media storage (Task 020)** | S3-compatible private adapter; default local disk; API contracts unchanged (multipart fields + authenticated GET bytes); **live bucket activation** owner-gated — see `docs/operations/MEDIA_OBJECT_STORAGE.md` |
| **VERIFIED (Neon)** | **KYC + canonical consent (Task 021)** | Registry + registration/job validation; verification sessions; HMAC webhooks (`mock` only in CI); counsel **ACTIVE** consent IDs still **DEFERRED**; Veriff **DEFERRED** until KYC-02 |
| **DEFERRED** | **D-08 billing / subscription (026B–026F)** | Owner 2026-10-28: no payment rails, ledger, or paid Club until re-authorized |
| **NEXT** | **D-06 owner activation** for Task 016 **or** checkout after MKT-03 | No fake prices/trials; enable interactive media only after D-06 sign-off |
| **CANCELLED** | Task 004 Flutter Edit Personal Details | Client work — separate Flutter repository (not this milestone) |
| **NEXT** | Signup/register contract vs Figma Screen 06 | Backend requires DOB + consents (D-02); reconcile API docs if product changes register shape — **no Flutter work in this repo** |
| **LIVE (MVP)** | Public profile / people discovery | Task 009 — authenticated reads only; favorites still private; geo/social **deferred** |
| **LATER** | Dashboard reuse, messaging, marketplace, billing | Per Figma slices |

## 4. Approved product and trust decisions — preserve

Unchanged from ADR-004 / `KYC_OWNER_DECISIONS_002B3A2.md` (D-01, D-02, D-02-AUTH, D-09, KYC-01/03/05, KYC-ENF-01..05). See `StrangeUp_ACTIVE_SCOPE_AND_DEFERRALS.md` §4 for full text if needed.

## 5. Deferred vs launch-blocking

| Item | Handling |
|---|---|
| Public profile / discovery enforcement | **DEFER** — D-03/D-04; self-service profile fields implemented Task 008/008A (policy approved) |
| Production avatar object storage | **DEFER** — local disk dev only (Task 008) |
| Custom / free-text interests (“Add Interest”) | **DEFER** — catalog-only LIVE (Task 007) |
| Bio max length | **APPROVED 300** on write (Task 006); legacy >300 preserved on GET until user edits |
| Stripe, KYC vendor, OAuth, phone OTP, production email | **DEFER** (unchanged) |
| Misleading copy (100% verified, E2EE, instant KYC) | **TRACK** — Flutter/design correction; do not edit source PDFs |

## 6. Figma evidence protocol

Maintain trace: `PDF filename | control | API | verified vs deferred`. Ask owner for specific frames when navigation or policy is ambiguous.

## 7. Completion log

### Neon PostgreSQL cutover — 2026-10-27

- **Topology:** isolated Neon catalogs `strangeup_dev` (dev) + `strangeup_test` (integration only). Direct hosts for setup/migrations; pooler URLs allowed at runtime.
- **Harness:** `integration-database-guard.ts` + `integration-global-setup.ts` (catalog name + live `current_database()`; `neondb` forbidden).
- **Interest PUT concurrency:** `FOR UPDATE` transaction; **last-write-wins** (no synthetic `409`); `T007-C01` expects both `200`.
- **Docs/scripts:** `docs/operations/NEON_POSTGRES.md`, `npm run db:neon:prepare|migrate|health`. Native scripts remain fallback-only.
- **Safety:** never TRUNCATE `strangeup_dev`, `neondb`, or production.

### Native PostgreSQL cutover — 2026-10-27 (superseded as default)

- **Topology:** `strangeup_dev` (dev) + `strangeup_test` (integration only) on `localhost:5432` — now an optional fallback.

### Task 013 — home, feed & notifications — 2026-10-27

- **Implemented:** `GET /v1/home`, `GET /v1/me/community-feed`, notification inbox + transactional hooks.
- **Deferred:** stories, push, scheduled reminders, KYC-success cards, photo/poll feed bodies.
- **Tests:** unit **132**; integration **76 passed**, 1 skipped on Neon `strangeup_test`.

### Task 012 — groups & communities — 2026-10-27

- **Figma source(s):** Screens 14, 15, 1, 2, 08 update, 16 (Phase 0; local PDFs not in current design-reference).
- **Implemented:** group catalog; create/manage; PUBLIC join vs PRIVATE pending; roles; posts/comments/likes; group chat; cover; Task 010 activity links.
- **Tests:** unit **131**; integration **72 passed**, 1 skipped on isolated Neon `strangeup_test`.
- **Deferred:** stories, photo posts, polls, nearby, verified-community badge, Home Dashboard aggregate, production media.
- **Decisions:** `D-GROUPS-TASK012.md` provisional; D-06 still OPEN.

### Task 011 — social connections — 2026-10-27

- **Implemented:** follow graph, waves, message requests, accepted 1:1 text, unread watermarks, D-03/block gates.
- **Not claimed:** E2EE, presence, device delivery, group chat, `FOLLOWERS_ONLY` activity publish.
- **Tests:** unit + written integration (native PG pending).

### Task 010 — activities & meetups — 2026-10-27

- **Figma source(s):** Screens 11–13 (task screen map; activity PDFs not in the current 13-file design-reference folder).
- **Implemented:** activity catalog; host draft/edit/publish/cancel; public list/detail; RSVP/waitlist; meeting privacy; cover upload; KYC fail-closed; waitlist hold-queue.
- **Tests:** unit coverage for validation/policy/DTO/query/cover; integration cases written (native PG pending).
- **Deferred:** geo/maps, Followers-only publish, attendee roster, check-in, invitations, payments, two-hour cutoff.

### Task 009 — discovery & public profiles — 2026-10-27

- **Policy:** D-03/D-04 MVP approved.
- **Implemented:** `UserBlock`; `GET /v1/discover/people`; `GET /v1/users/:userId` (+ avatar); `/v1/me/blocks`.
- **Tests:** `public-profile-policy.test.ts`, `discover-query.test.ts`, `discovery.integration.test.ts` (integration pending PG).
- **Deferred:** map, distance, presence, Follow/Wave/Message, Screen 11 activities.

### Task 008A — own profile policy reconciliation — 2026-10-27

- **Owner decisions:** All five OWN-PROFILE rows **APPROVED** (visibility default revised to `VERIFIED_USERS_ONLY` for new rows).
- **Implemented:** migration `20261027153000_profile_visibility_default_verified`; avatar `sharp` decode/re-encode + path guards; unit tests `avatar-image-processor`, `local-avatar-storage`.
- **Integration:** Pending native `strangeup_test` + `RUN_INTEGRATION=1` (Tasks 006–008A section gate).
- **Deferred:** Cross-user visibility enforcement, geo/verified location badge, production object storage/moderation, Activity entity links for favorites.

### Task 008 — own profile extensions — 2026-10-27

- **Figma source(s) rechecked:** `Html → Body-1.pdf` (favorites, visibility, location, photo).
- **Implemented:** migration `20261027140000_own_profile_extensions`; `GET/PUT /v1/me/favorite-activities`; profile `profileVisibility` / `locationCity` / `locationRegion`; `POST/GET/DELETE /v1/me/profile/avatar`.
- **Superseded by 008A** for policy defaults and avatar hardening (see above).

### Task 007 — profile interests catalog — 2026-10-27

- **Figma source(s) rechecked:** `Html → Body-1.pdf` (Your Interests chips).
- **Implemented:** `Interest` + `UserInterest`; migration `20261027120000_profile_interests`; `GET /v1/interests`, `GET/PUT /v1/me/interests`.
- **Unit tests:** **50** passed (includes interests validation + DB guard).
- **Deferred:** Custom Add Interest, public interest display (D-03), favorite activities as domain entities.
- **Git checkpoint:** Uncommitted local changes; no push.

### Task 006 — username management & bio limit — 2026-10-27

- **Figma source(s) rechecked:** `Html → Body-1.pdf` (username, About Me 300 counter).
- **Implemented / verified:** `Profile.username` + `LOWER(username)` unique index; `PATCH/GET` profile contract; bio PATCH max 300; legacy bio preservation.
- **API changes + Flutter handoff:** `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md` §9, `openapi/identity.yaml`, `PROFILE_OWNER_DECISIONS_TASK006.md`.
- **Tests actually run:** See completion report (prisma validate/generate, typecheck, lint, format:check, unit, integration, build).
- **Deferred:** Public username lookup, visibility, interests, location, avatar — unchanged.
- **Git checkpoint:** Uncommitted local changes; no push.

### Task 005 slice 1 — CLOSED — authenticated password change — 2026-10-27

- **Figma source(s) rechecked:** `Screen 26_ Profile & Settings.pdf` (Password & Security row).
- **Implemented / verified:** `POST /v1/me/password-change`; policy `canChangePassword`; rate limits; atomic hash update + session revocation.
- **Tests actually run:** `RUN_INTEGRATION=1` — password-change filter **6 passed**; full integration **30 passed**, **1 skipped**; unit **37 passed** (`strangeup_dev` on `localhost:51214`, dev `template1` / integration `strangeup_test` URL paths).
- **API changes + Flutter handoff:** `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md` §9, `openapi/identity.yaml`.
- **Deferred (Task 005 umbrella):** 2FA, blocked users, delete account, subscription rows; D-03/D-04 profile fields unchanged.
- **Git checkpoint:** Uncommitted local changes; no push.

### Task 005 slice — authenticated password change — 2026-10-26

- Initial implementation landed (see slice 1 closure above for verification).

### Scope boundary + Task 004 cancellation — 2026-10-26

- **Policy:** Backend-only responsibility documented in `AGENTS.md` and `.cursor/rules/engineering.mdc`. Flutter is external; handoff docs are integration contracts only.
- **Task 004:** Cancelled as backend milestone; superseded by proposed **Task 005** (profile/settings backend gaps).
- **Deferred preserved:** Stripe, KYC vendor, ESP, OAuth, phone OTP unchanged in §5.

### Task 003A — 2026-10-26

- **Verification:** Restored integration DB (separate `strangeup_test` database on dev Prisma TCP `51214`; named Prisma Dev instance `strangeup_test` remained `starting_up` — see README recovery). Migrations applied; `RUN_INTEGRATION=1`: **23 passed, 1 skipped**. Full gate: prisma validate/generate, typecheck, lint, format:check, 32 unit tests, build — **pass**.
- **Fixes:** README erroneous KYC appendix removed; integration recovery note added; suspended `/v1/me` test aligned to **401** (I-N04); `CURRENT_APIS.md` suspended wording corrected.
- **Next slice:** **Task 005** backend profile/settings gap analysis; owner authorization for D-03/D-04/media/etc. before schema changes. Task 004 (Flutter) **cancelled** in this repo.

### Task 003 — 2026-10-26

- **Figma source(s) rechecked:** `Html → Body-1.pdf`, Screens 2–7, 10, 26, 05–06 (text extraction + render); `design-reference/` 13-file package present locally.
- **Implemented / verified:** Profile contract re-audited; unit tests for `profilePatchSchema`; integration tests for `birthDate` rejection, bio >500, `firstName`/`lastName` PATCH, suspended `/v1/me` 403; policy test for suspended edit denial.
- **API changes + Flutter handoff:** No new routes; handoff §9 expanded with Figma field mapping and signup conflict notes; parity matrix added.
- **Tests actually run:** See Task 003 engineering report (quality gate output).
- **Deferred:** Username, location, interests, favorites, visibility, media, public profile, KYC UI, settings hub rows beyond account/profile.
- **Next slice:** Backend **Task 005**; Flutter post-verify profile UI is **external** (handoff §9 documents safe PATCH fields). Parallel owner decisions on D-03/D-04/D-BIO-MAX/signup DOB.
- **Git checkpoint:** Uncommitted local changes; no push.
