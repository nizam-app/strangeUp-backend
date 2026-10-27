# StrangeUp Engineering Status (as of 2026-10-27, Task 021)

| Scope | Status | Evidence / blockers |
|---|---|---|
| Figma exported visual discovery | **VERIFIED (Task 003)** | 13 focus PDFs in `design-reference/`; full 49-file manifest hashed; parity matrix `FIGMA_PROFILE_PARITY_MATRIX_2026-10-26.md` |
| **Task 003 — Figma profile parity & safe slice** | **COMPLETE (local)** | No new APIs; profile contract + tests + Flutter mapping; policy-blocked fields documented |
| **Task 003A — verification closure** | **VERIFIED (local)** | Integration DB restored; 23 integration + 32 unit tests pass; format:check pass |
| Product specification | DRAFT | `PRD_DRAFT.md`; identity Phase 1 decisions approved (ADR-004) |
| Screen traceability | DRAFT COMPLETE | 39 CSV-based mapped records; source evidence from PDFs |
| MVP selection | PARTIAL | D-01, D-02, D-02-AUTH, D-09, **D-03/D-04 MVP** approved; other D-* open |
| Architecture | PROPOSED | modular monolith; owner technology stack confirmed |
| Conceptual data model | **IMPLEMENTED (identity slice)** | Prisma migration `20261026065612_identity_phase1` |
| API design | **PARTIAL LIVE** | `/health/*`, `/v1/auth/*`, `/v1/me/*`, `/v1/interests`, `/v1/discover/*`, `/v1/users/*`, `/v1/activities*`, `/v1/activity-categories`, social follow/wave/DM, `/v1/groups*`, `/v1/group-categories` |
| **Task 001 — backend foundation** | **IMPLEMENTED** | Express, config, health, Prisma 7 adapter, unit tests, CI workflow |
| **Task 001.1 — local DB + Git baseline** | **VERIFIED (local)** | Prisma Dev instances, ready 200/503, integration health test |
| **Task 002A / 002A1** | **COMPLETE (docs)** | ADR-004, API/handoff docs |
| **Task 002B.1 — identity schema + email auth** | **IMPLEMENTED (local)** | Migration, auth module, policy stubs, OpenAPI `identity.yaml` |
| **Task 002B.1A — auth security review & closure** | **VERIFIED (local)** | Targeted fixes; expanded auth integration tests |
| **Task 002B.2 — reset + self account/profile** | **IMPLEMENTED (local)** | Password reset, `/v1/me/*`, docs + integration tests |
| **Task 002B.2A — auth stabilization** | **VERIFIED (local)** | `strangeup_test` restored; scrypt p=5 preferred + rehash-on-login; full quality gate |
| Local PostgreSQL (Neon) | **ACTIVE** | Isolated Neon catalogs `strangeup_dev` + `strangeup_test`; see `docs/operations/NEON_POSTGRES.md` |
| Local PostgreSQL (native 18) | **FALLBACK** | `localhost:5432` optional; see `docs/operations/NATIVE_POSTGRES_LOCAL.md` |
| Local PostgreSQL (Prisma Dev) | **FALLBACK** | Preserved in `.env` comments; not used for integration after Neon cutover |
| Integration test (live PostgreSQL) | **VERIFIED (Neon)** | `strangeup_test` identity check passed; suite **63 passed**, 1 skipped (enable-docs placeholder) |
| **Task 005 — authenticated password change (slice 1)** | **COMPLETE & VERIFIED (local)** | `POST /v1/me/password-change`; integration **6/6** password-change cases + full suite **30 passed**, 1 skipped (2026-10-27) |
| **Task 006 — username & bio limit** | **VERIFIED (local)** | Migration `20261027103000_profile_username`; unit **41** pass; `me.integration.test.ts` **20/20** with Prisma Dev TCP up |
| **Task 007 — profile interests** | **VERIFIED (Neon)** | Migration `20261027120000_profile_interests`; catalog seed + PUT isolation + `T007-C01` last-write-wins on Neon PG 18.6 |
| **Task 008 — own profile extensions** | **IMPLEMENTED** | Superseded by 008A for policy + avatar hardening; base migration `20261027140000_own_profile_extensions` |
| **Task 008A — profile policy reconciliation** | **VERIFIED (Neon)** | Visibility default, location, favorites, avatar byte checks against `strangeup_test` |
| **Task 009 — discovery & public profiles** | **VERIFIED (Neon)** | D-03/D-04 MVP; migration `20261027160000_user_blocks`; discover + public profile + block 404 |
| **Task 010 — activities & meetups** | **VERIFIED (Neon)** | Migration `20261027180000_activities`; KYC fail-closed publish/confirm; waitlist; meeting privacy |
| **Task 011 — social connections & 1:1 messaging** | **IMPLEMENTED** | Migration `20261027190000_social_connections`; follow/wave/requests/1:1; no E2EE/presence; `FOLLOWERS_ONLY` still unpublished |
| **Task 012 — groups & communities** | **VERIFIED (Neon)** | Migration `20261027200000_community_groups`; discovery, membership, posts, group chat, activity links; stories/polls/photo posts deferred |
| **Task 013 — home, feed & notifications** | **VERIFIED (Neon)** | Migration `20261027210000_user_notifications`; `/v1/home`, `/v1/me/community-feed`, notification inbox + hooks; stories deferred |
| **Task 014 — store & jobs** | **VERIFIED (Neon)** | Migration `20261027220000_store_and_jobs`; `/v1/store/*`, `/v1/jobs/*`, self cart/favorites/applications; checkout & employer delivery deferred |
| **Task 015 — settings & account lifecycle** | **VERIFIED (Neon)** | Migration `20261027230000_saved_activities_settings`; settings overview, saved activities, email change (DEV_ONLY), sessions, deletion impact; no destructive delete |
| **Task 016 — stories, photo posts & polls** | **IMPLEMENTED (disabled default)** | Migration `20261027240000_community_stories_media_polls`; routes behind `GROUP_COMMUNITY_INTERACTIVE_ENABLED=false`; Home stories **DEFERRED**; D-06 provisional |
| **Task 017 — membership plans & entitlements** | **IMPLEMENTED** | No migration; `GET /v1/membership/plans`, `GET /v1/me/membership`; settings overview `membership`; Club **NOT_CONFIGURED**; D-08 checklist in `OPEN_QUESTIONS.md` |
| **Task 018 — release hardening (phase 1)** | **VERIFIED (Neon)** | Production env fail-closed; format drift diagnosis; unit **169**; integration **97 passed**, 1 skipped (Tasks 006–017 regression) |
| **Task 019 — auth email & abuse protection** | **IMPLEMENTED (local)** | Transport boundary; fail-closed modes; ops runbook |
| **Task 019B — Resend + Upstash adapters** | **IMPLEMENTED (local)** | `createResendEmailSender`, `createRedisRateLimitStore` (rediss:// + Lua); **no live vendor calls in CI**; production activation still requires deployment secrets + owner deploy authorization |
| **Task 020 — production media storage** | **IMPLEMENTED (local)** | S3-compatible private adapter (`@aws-sdk/client-s3`); `MEDIA_STORAGE_BACKEND=local|s3`; avatars, activity/group covers, gated group content wired; store images local read-only; **no live bucket writes in CI**; ops guide `docs/operations/MEDIA_OBJECT_STORAGE.md` |
| **Task 021 — KYC + canonical consent** | **VERIFIED (Neon)** | Migration `20261027250000_kyc_verification_consent`; `GET /v1/consents/required`; verification sessions + mock webhook; Veriff **BLOCKED BY OWNER**; unit **198**; integration **101 passed**, 1 skipped |
| Unit tests / quality gates | **VERIFIED (2026-10-27, Neon, Task 021)** | prisma validate/generate; typecheck; lint; build; unit + integration on `strangeup_test` |
| Consent document versions | **RELEASE BLOCKER (partial fix)** | Server registry + validation live; counsel **ACTIVE** legal version IDs still pending (`CONSENT_ENFORCEMENT=strict` in production) |
| Email delivery | **ADAPTER READY** | Resend SDK wired behind `TRANSACTIONAL_EMAIL_MODE=provider`; default remains `dev_stub`; inbox delivery not verified in CI |
| Distributed rate limiting | **ADAPTER READY** | Upstash via `ioredis` + `RATE_LIMIT_REDIS_URL`; async `checkRateLimit`; fail-closed on Redis errors |
| Native PostgreSQL concurrency testing | **VERIFIED (Neon PG 18.6)** | `T005-C01`, `T006-C01`, `T007-C01`, `T010-C01` passed on isolated `strangeup_test` |
| Payment/verification provider choices | UNRESOLVED | KYC vendor open (D-09); decision register in `docs/product/KYC_REQUIREMENTS_DECISION_GATE.md` |
| **Task 002B.3A — KYC architecture (docs)** | **COMPLETE (design)** | Architecture + candidate APIs + acceptance matrix |
| **Task 002B.3A1 — KYC owner handoff** | **COMPLETE** | KYC-01 recorded |
| **Task 002B.3A2 — approved KYC policy docs** | **COMPLETE** | `KYC_OWNER_DECISIONS_002B3A2.md` |
| **Task 002B.3A3 — vendor & lifecycle readiness** | **COMPLETE (docs)** | `KYC_VENDOR_EVALUATION.md`, `KYC_LIFECYCLE_DECISION_OPTIONS.md`, `KYC_PRIVACY_VENDOR_CHECKLIST.md`; **KYC-02 not selected**; **002B.3B not started** |
| Deployment | UNRESOLVED | no remote or production deploy |

## Task 002B.2A stabilization (2026-10-26)

- **Test isolation:** `npx prisma dev start strangeup_test`; dev `localhost:51214/template1` vs integration `localhost:51218/template1` (distinct Prisma Dev instances).
- **Password hashing:** New hashes use scrypt **N=16384, r=8, p=5** (~224ms benchmark on dev machine); legacy **p=1** hashes remain valid; successful login rehashes to preferred parameters.
- **Docs:** README integration recovery workflow.

## Task 002B.2 implementation summary

- **Password recovery:** `POST /v1/auth/password-reset/request|confirm` using `AuthChallenge` type `PASSWORD_RESET`; session revocation on confirm; enumeration-safe 202; rate limits per IP/email.
- **Self account:** `GET /v1/me/account` for pending + active users (not suspended/deleted).
- **Profile:** `GET` / `PATCH /v1/me/profile` with strict allowlist (`firstName`, `lastName`, `displayName`, `username`, `bio`, `scheduleTimeZone`); edits require verified email + age eligible.
- **Hardening:** scrypt verify now applies stored `N/r/p`; per-user cap on email verification resend; optional `PUBLIC_APP_BASE_URL` for reset links.
- **Docs:** `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md` §8–9, `openapi/identity.yaml`, `IDENTITY_ACCEPTANCE_MATRIX.md` §002B.2.

## Task 002B.3B gate (policy documented — implementation **not authorized**)

1. **KYC-02** — **owner selects** provider after `KYC_VENDOR_EVALUATION.md` + privacy checklist; sandbox only after contract.
2. **Schema** — session vs user status enums and transitions (not finalized).
3. **KYC-04** — retry, appeal, outage, revocation remediation detail (beyond ENF-04 bounds).
4. **KYC-05 detail** — exact metadata allowlist, retention/deletion after legal review (D-09-retention, KYC-06).
5. **KYC-07** — Flutter copy and error surfaces.
6. **D-09-kyc-enforcement-ops** — waitlist timers, modality reclassification, API operation names.
7. Webhook authenticity, idempotency, native PG concurrency tests at feature boundaries.

**Recommended 002B.3B scope (engineering proposal only):** provider-neutral verification **foundation** (schema + policy hooks + denial codes) **without** production vendor or mock `APPROVED` — owner must explicitly authorize start.

## Task 003A summary (2026-10-26)

- **Blocker:** `strangeup_test` Prisma Dev named instance stuck `starting_up`; integration recovered via separate database on dev TCP (fail-closed isolation guard confirmed).
- **Quality gate:** all required scripts pass including integration suite.
- **README:** removed accidental KYC handoff appendix; added recovery note for alternate test DB path.

## Task 003 summary (2026-10-26)

- Re-opened priority PDFs under `design-reference/`; mapped controls to LIVE `/v1/me/*` and auth register (see parity matrix).
- **Safe LIVE fields:** `firstName`, `lastName`, `displayName`, `username`, `bio` (max 300 on write), `scheduleTimeZone`; read-only `birthDate`.
- **Tests added:** `tests/me.validation.test.ts`; integration coverage for mass-assignment guards, suspended account, name PATCH.
- **Not implemented (by design) at Task 003:** location, interests, favorite activities, visibility, avatar, public profile discovery — **superseded by Tasks 007–008** for self-service fields; public/discovery still blocked (D-03/D-04).

## Task 004 — CANCELLED (scope)

- **Task 004** (Flutter Edit Personal Details client slice) is **cancelled** as a backend-repo milestone. Safe-field APIs and handoff §9 are complete (Tasks 003/003A). Flutter implementation is **out of repo scope** — separate Flutter repository/developer.

## Task 005 — slice 1 closed (2026-10-27) — authenticated password change

- **Figma:** `Screen 26_ Profile & Settings.pdf` — Password & Security (change while logged in).
- **Route:** `POST /v1/me/password-change` — current-password verify, scrypt hash, optimistic `passwordHash` update, revoke all sessions, clear pending reset challenges.
- **Docs:** `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md`, `openapi/identity.yaml`, parity matrix row.
- **Verification (2026-10-27):** `RUN_INTEGRATION=1` — `me.integration.test.ts` filter T005/password-change: **6 passed**; full integration: **30 passed**, **1 skipped**; unit: **37 passed**.
- **Task 005 umbrella (remaining):** account deletion, email change, signup vs Screen 06 — **not started**; owner authorization required (separate slices).

## Task 006 summary (2026-10-27)

- **Figma:** `Html → Body-1.pdf` — username + About Me (300 counter).
- **Schema:** `Profile.username` + case-insensitive unique index; no bio column truncation.
- **API:** `username` on GET/PATCH; `409 CONFLICT` on duplicate; bio validation **300** on explicit bio PATCH; legacy long bios preserved on read/partial update.
- **Docs:** `PROFILE_OWNER_DECISIONS_TASK006.md`, API handoff, OpenAPI, parity matrix.

## Task 007 summary (2026-10-27)

- **Figma:** `Html → Body-1.pdf` — Your Interests chips (10 labels).
- **Schema:** `Interest` catalog (migration seed) + `UserInterest` join; composite PK prevents duplicate associations.
- **API:** `GET /v1/interests` (catalog metadata); `GET/PUT /v1/me/interests` (private selection; PUT replacement semantics).
- **Deferred:** Custom Add Interest, public/discovery exposure (D-03).
- **Docs:** `D-INTERESTS-CATALOG-task007.md`, API handoff §9.1, OpenAPI, parity matrix.

## Task 008 summary (2026-10-27)

- **Figma:** `Html → Body-1.pdf` — favorite activity cards, visibility radios, location line, change photo.
- **Schema:** `ProfileFavoriteActivity`; profile columns for visibility, location text, avatar metadata.
- **API:** `GET/PUT /v1/me/favorite-activities`; `profileVisibility` / `locationCity` / `locationRegion` on profile GET/PATCH; `POST/GET/DELETE /v1/me/profile/avatar` (local `PROFILE_UPLOAD_DIR`).

## Task 008A summary (2026-10-27)

- **Owner:** All five decisions in `D-OWN-PROFILE-REMAINING-REQUEST-task008.md` **APPROVED** (visibility default revised).
- **Reconciliation:** Prisma default + migration `20261027153000_profile_visibility_default_verified` (existing rows unchanged); avatar decode/re-encode, EXIF strip, dimension/pixel caps, opaque storage keys, path ownership.
- **Tests (no DB):** unit suite includes `avatar-image-processor`, `local-avatar-storage`; integration cases T008A-P01/P02 added (run when `RUN_INTEGRATION=1`).
- **Section status:** **IMPLEMENTED — INTEGRATION VERIFICATION PENDING** (native PostgreSQL credentials).

## Task 009 summary (2026-10-27)

- **Policy:** D-03/D-04 MVP — discovery + public profile reads (authenticated only).
- **API:** `GET /v1/discover/people`, `GET /v1/users/:userId`, `GET /v1/users/:userId/avatar`, `/v1/me/blocks`.
- **Schema:** `UserBlock` migration `20261027160000_user_blocks`.
- **Section status:** **IMPLEMENTED — INTEGRATION VERIFICATION PENDING**.

## Task 010 summary (2026-10-27)

- **Figma:** Screens 11–13 — discovery, details, create activity.
- **Schema:** `ActivityCategory`, `Activity`, `ActivityParticipation`; migration `20261027180000_activities`.
- **API:** catalog, public list/detail/cover/meeting, host draft/edit/publish/cancel/cover, RSVP/leave, my RSVPs.
- **KYC:** real-world publish/confirm/meeting gated; production fail-closed; waitlist hold-queue (no skip).
- **Section status:** **IMPLEMENTED — INTEGRATION VERIFICATION PENDING**.
- **Decisions:** `docs/decisions/D-ACTIVITIES-TASK010.md`.

## Task 011 summary (2026-10-27)

- **Figma:** Screens 09/10/16/17 — follow, wave, message requests, 1:1 text.
- **Schema:** `UserFollow`, `UserWave`, `DirectMessageRequest`, `DirectConversation`, `DirectConversationParticipant`, `DirectMessage`.
- **Section status:** **IMPLEMENTED — INTEGRATION VERIFICATION PENDING**.
- **Decisions:** `docs/decisions/D-SOCIAL-TASK011.md`. `FOLLOWERS_ONLY` activity publish remains rejected.

## Task 012 summary (2026-10-27)

- **Figma:** Screens 14/15/1/2/08/16 (Phase 0 + task list; group PDFs not in the current local design-reference folder).
- **Schema:** `CommunityGroup*` + membership/posts/comments/likes/messages/read-state/activity-link; migration `20261027200000_community_groups`.
- **API:** catalog, discovery, create/manage, join/approve, posts/comments/likes, group chat, cover, linked activities.
- **Not claimed:** verified-community badge, nearby, stories, polls, photo posts, E2EE, presence.
- **Decisions:** `docs/decisions/D-GROUPS-TASK012.md` (provisional; D-06 open).
- **Section status:** **VERIFIED (Neon `strangeup_test`)** — integration **72 passed**, 1 skipped including T012-P01..P08 and T012-C01.

## Task 013 summary (2026-10-27)

- **Figma:** Screen 08 Home Dashboard (+ Community & Stories Update), Html → Notification.pdf.
- **Schema:** `UserNotification` + `UserNotificationType`; migration `20261027210000_user_notifications`.
- **API:** `GET /v1/home`; `GET /v1/me/community-feed`; `GET/POST /v1/me/notifications*` (read + read-all).
- **Hooks:** message request create/accept, direct message send (aggregated), group join approve/decline, RSVP confirm/waitlist/promotion.
- **Deferred:** 24h stories, push/email, fabricated KYC/membership/invitation/reminder cards, photo/poll/share posts in feed.
- **Parity:** `docs/product/FIGMA_HOME_FEED_NOTIFICATIONS_PARITY_TASK013.md`.
- **Section status:** **VERIFIED (Neon)** — integration **76 passed**, 1 skipped; unit **132**; T013-H01–H04.

## Task 015 summary (2026-10-27)

- **Figma:** `Screen 26_ Profile & Settings.pdf` — hub parity matrix `FIGMA_SETTINGS_PARITY_TASK015.md`.
- **Schema:** `SavedActivity` join; `AuthChallengeType.EMAIL_CHANGE`; migration `20261027230000_saved_activities_settings`.
- **API:** settings overview, saved activities, session inventory/revoke, email change (DEV_ONLY), account-deletion impact (non-destructive).
- **Not shipped:** destructive delete, 2FA, subscription/billing, production email, phone verify write path.
- **Decisions:** SET-01..SET-05 provisional in `OPEN_QUESTIONS.md`.
- **Section status:** **VERIFIED (Neon)** — unit **148**; integration **87 passed**, 1 skipped (Tasks 006–015 regression).

## Task 017 summary (2026-10-27)

- **Figma:** `Screen 18_ Membership Plans.pdf` — parity `FIGMA_MEMBERSHIP_PARITY_TASK017.md`.
- **Schema:** none (server-owned plan registry in `src/modules/membership/*`).
- **API:** `GET /v1/membership/plans`, `GET /v1/me/membership`; settings overview `membership` + `capabilities.membershipPlanCatalog`.
- **Not shipped:** subscribe/upgrade, trials, Club pricing, webhooks, entitlement enforcement on existing APIs.
- **Decisions:** D-08 checklist in `OPEN_QUESTIONS.md` (OPEN).
- **Section status:** **VERIFIED (Neon)** — unit **156** (39 files); integration **97 passed**, 1 skipped (`GET /health/ready` docs placeholder); Tasks 006–016 regression included.

## Task 018 summary (2026-10-27)

- **Production startup:** `loadEnv()` rejects unsafe `NODE_ENV=production` (weak JWT, missing `PUBLIC_APP_BASE_URL`, localhost CORS, `.data` upload dirs, D-06 interactive flag, KYC provider flag without vendor).
- **HTTP fail-closed:** email-change request/confirm return **`403 FEATURE_DISABLED`** in production (dev stub email remains non-production).
- **Tooling:** `.gitattributes` + `.editorconfig` (LF); `scripts/format-drift-diagnosis.ts` + `npm run format:diagnose` — classifies CRLF vs substantive Prettier drift without mass reformat.
- **Tests:** `tests/production-env.test.ts`, `tests/settings-feature-gates.test.ts`, `tests/rate-limit.test.ts`.
- **Format diagnosis (2026-10-27):** `npm run format:diagnose` — **218** line-ending-only, **27** substantive (incl. new Task 018 files + legacy drift); **245** files fail global `format:check` on this Windows workspace; CI (Ubuntu LF) may differ.
- **Not resolved:** distributed rate limiting, production ESP, KYC vendor, consent canonical IDs, repository-wide LF normalization (owner approval for one-time mechanical commit).

## Immediate next steps (backend only)

1. **Next milestone (owner-gated):** **D-08 billing provider integration** after commercial sign-off **or** **D-06 activation** for Task 016 interactive media **or** MKT-03 checkout.
2. Owner: **SET-03** account deletion retention/disposition; **SET-01** production email for change/reset/verify.
3. Owner: D-06 group policy residual; authorize **Task 002B.3B** KYC foundation only when explicitly approved.
4. Distributed rate limiting + production ESP before staging account-recovery UX at scale.
5. Git logical commits / remote when owner approves.
