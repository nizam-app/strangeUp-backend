# Task 030 — Backend completion & admin panel readiness audit

**Date:** 2026-10-29  
**Mode:** Read-only (no code, migrations, commits, or Admin UI implementation)  
**Evidence:** Tasks 001–029H engineering reports, `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md`, `MASTER_DEFERRED_WORK_QUEUE.md`, `ACTIVE_SCOPE_AND_DEFERRALS.md`, Prisma migrations (22 in repo), live Neon health check (`npm run db:neon:health`), admin/KYC source under `src/modules/admin/*`, `src/modules/verification/*`, integration test inventory.

**Team boundary:** Flutter UI is external; this audit covers **Node.js backend**, **PostgreSQL**, integrations, and readiness for a **separate** React Admin Panel workspace.

---

## Executive summary

| Dimension | Assessment |
|---|---|
| **Flutter API integration (staging/dev)** | **Strong** — versioned REST + Socket.IO for messaging; Task 022 activation gate enforced; bounded Neon suites pass per vertical (unit **285/285** as of 029H). Many Figma-adjacent features are **honestly DEFERRED** via `capabilities` and env flags — Flutter must gate UI on server contracts, not design alone. |
| **Production / public release** | **Not ready** — release blockers MDWQ-0099–0103 remain (full regression, deploy topology, counsel consent IDs, prod email, prod media/KYC). Checkout, billing, OAuth, phone OTP, Veriff live, FCM prod, and destructive account deletion are **owner-deferred or decision-required**. |
| **Admin identity review (Task 022B)** | **API-complete for MVP queue workflow** — list/detail/approve/reject with session binding, idempotency, audit rows, mock KYC in test; **no Admin Panel UI**, no global user search, no suspend/revoke REST, no request-more-info, no free-text review notes. |
| **Meetup invites (Task 028)** | **Backend implemented** on `strangeup_test`; **`capabilities.meetupInvites` remains DEFERRED** until owner LIVE sign-off; **`strangeup_dev` missing migrations 028C+028G** (dev catalog drift). |
| **Recommended next work** | **Task 031** — minimal separate-repo Admin Panel on existing `/v1/admin/identity-reviews/*`; parallel **P0** backend ops: apply dev migrations, staff grant runbook, mock KYC staging playbook; **P1** release gate items per checklist. |

---

## Part A — Backend completion audit

### A.1 Classification legend (this report)

| Label | Meaning |
|---|---|
| **IMPLEMENTED** | Routes/services exist; behavior verified in source and/or bounded integration tests cited in task reports. |
| **PARTIAL** | Core path exists; product/Figma gaps, flags, or enforcement incomplete. |
| **MISSING** | No backend implementation for an approved requirement. |
| **DEFERRED** | Explicit owner deferral or `UNAVAILABLE`/`DEFERRED` contract — do not implement without re-authorization. |
| **RELEASE_BLOCKER** | Must resolve or accept as launch risk before production (see MDWQ-0099–0105). |

**Flutter vs release:** **IMPLEMENTED** often suffices for Flutter wiring in dev/staging (mock KYC, placeholder consents). **RELEASE_BLOCKER** and **DEFERRED** items block **production** launch regardless of UI completeness.

---

### A.2 Domain readiness matrix

| Domain | Flutter integration | Production release | Notes |
|---|---|---|---|
| **Auth & sessions** | **IMPLEMENTED** | **PARTIAL** | Register/login/refresh/revoke; email verify; password reset. OAuth/phone **DEFERRED** (MDWQ-0201–0203). Prod email **RELEASE_BLOCKER** (MDWQ-0102). |
| **Task 022 activation gate** | **IMPLEMENTED** | **IMPLEMENTED** (policy) | `requireHomeAccess` + DB reload; ADR-005; E2E `auth-flow-e2e.task022d`. Prod still needs real KYC + counsel consents. |
| **KYC / IDV** | **PARTIAL** | **DEFERRED / BLOCKER** | Mock sessions + HMAC webhooks **IMPLEMENTED** (021/022). Veriff live **OWNER_DEFERRED** (MDWQ-0302). Prod KYC authority **RELEASE_BLOCKER** (MDWQ-0309). |
| **Admin identity review APIs** | N/A (Admin Panel) | **PARTIAL** | REST **IMPLEMENTED**; UI **MISSING**; suspend writer **MISSING** (MDWQ-0507). |
| **Profiles & settings** | **IMPLEMENTED** | **PARTIAL** | Self profile, avatar (local/S3 adapter), settings overview, sessions, saved activities. Delete **UNAVAILABLE** (MDWQ-1101). Email change **DEV_ONLY** (MDWQ-1103). 2FA **DEFERRED**. |
| **Discover & public profiles** | **IMPLEMENTED** | **PARTIAL** | D-03/D-04 MVP; no geo radius/maps (MDWQ-0401). `profileVisibility` stored; expanded enforcement **DECISION_REQUIRED** (MDWQ-0403). |
| **Messaging & header** | **IMPLEMENTED** | **PARTIAL** | REST summary + Socket.IO DM/group (single instance); no E2EE/presence/media (MDWQ-0501–0503). FCM **DISABLED_BY_FLAG** (MDWQ-0508). Redis socket cluster **DISABLED** (MDWQ-0509). |
| **Groups** | **IMPLEMENTED** | **PARTIAL** | Core 012 + 029B–D; interactive stories/polls **DEFERRED** (D-06, MDWQ-0602). Figma source gap **RELEASE_BLOCKER** for parity claims (MDWQ-0910–0911). |
| **Activities** | **IMPLEMENTED** | **PARTIAL** | Core 010 + 025C + 027B–F (join approval, roster, privacy). 027G/H skipped (chat, ACT-NOTIFY). Payments **DEFERRED**. |
| **Personal meetups (028)** | **PARTIAL** | **PARTIAL** | REST + notifications **IMPLEMENTED** on test DB; capability flag **DEFERRED** for product LIVE. Reschedule **DEFERRED** (MDWQ-0724). |
| **Jobs** | **PARTIAL** | **PARTIAL** | List/detail/save/apply **IMPLEMENTED** (014/029F). Publish/employer delivery **DEFERRED/SKIPPED** (MDWQ-0901–0902, 029G). |
| **Marketplace / store** | **PARTIAL** | **PARTIAL** | Browse/cart/favorites/pricing quote **IMPLEMENTED**; checkout **OWNER_DEFERRED** (MDWQ-0801). Staff catalog CRUD **DISABLED_BY_FLAG** (MDWQ-0805). |
| **Membership** | **IMPLEMENTED** (read-only) | **DEFERRED** | Plans + honest `flow`; billing **OWNER_DEFERRED** D-08 (MDWQ-1001). |
| **Home & notifications** | **IMPLEMENTED** | **PARTIAL** | Pull inbox + hooks; stories row **DEFERRED** (MDWQ-0601). Push prod off. |
| **Notifications (meetup)** | **PARTIAL** | **PARTIAL** | In-app + outbox path; gated by prefs; meetup product capability **DEFERRED**. |

---

### A.3 Unfinished backend (excluding owner-deferred checkout/payments)

**P0 — staging / admin verification path**

1. Apply pending migrations to **`strangeup_dev`** (`20261029170000_task028c_personal_meetup_invitation`, `20261029180000_task028g_meetup_notifications`) — **ops only**, not auto-run in this task (MDWQ-0310).
2. Staff **`PlatformStaffGrant`** provisioning for reviewers (SQL runbook — `PLATFORM_STAFF_PROVISIONING.md`); no HTTP bootstrap in prod.
3. **`CONSENT_ENFORCEMENT`** + counsel **`activeVersionId`** for strict register (MDWQ-0101) — blocks realistic staging if set to `strict` without IDs.
4. Optional: enable **`KYC_PROVIDER_ENABLED`** + mock webhook secret in staging for end-to-end admin approve demos.

**P1 — security, compliance, release**

1. Full Neon regression suite (MDWQ-0099).
2. Production email (verify/reset/change) (MDWQ-0102, 0204, 1103).
3. Production media/S3 activation (MDWQ-0103, 0810).
4. Account deletion workflow (MDWQ-1101) — impact API only today.
5. Platform **suspend/deactivate REST** + wire `applyAccountRestrictionSideEffects` (MDWQ-0507) — hook exists, no admin writer.
6. Abuse reporting beyond group content reports (MDWQ-0607) — group-level reports **PARTIAL** only.
7. Admin **request-more-info** (022D gap #6) — **MISSING** endpoint.
8. Post-approval **admin revocation** of activation (distinct from user reject at pending) — **MISSING** dedicated admin API (KYC revocation paths exist for provider; staff reversal policy **DECISION_REQUIRED**).
9. Dedicated integration test: **socket eviction on moderator remove** (029H documented gap).
10. **`SOCKET_IO_REDIS_ADAPTER_ENABLED`** — fail-closed until adapter implemented (multi-instance prod).

**P2 — product optional**

- Geo/distance (D-04), federated search (MDWQ-0405), activity followers-only publish (MDWQ-0702), jobs badges (MDWQ-0906), group dashboard deltas (MDWQ-0915), saved-activities count vs visible list (MDWQ-0718), etc. — all indexed in MDWQ.

---

### A.4 Account deletion, reporting, consent, production dependencies

| Area | Status | Evidence |
|---|---|---|
| **Account deletion** | **PARTIAL** — `GET /v1/me/account-deletion/impact` returns **UNAVAILABLE** narrative; no `DELETE /v1/me/account` | `account-deletion-impact.service.ts`, `settings-capabilities.ts`, MDWQ-1101, `CURRENT_APIS.md` PLANNED |
| **Reporting / moderation** | **PARTIAL** — `POST/GET /v1/groups/:groupId/content-reports` for group moderators; no platform-wide trust & safety API | `groups.routes.ts`, MDWQ-0607 |
| **Consent** | **PARTIAL** — registry + registration validation **IMPLEMENTED**; production **`strict`** + counsel IDs **RELEASE_BLOCKER** | MDWQ-0101, Task 021 |
| **Prod email** | **FOUNDATION_ONLY** — Resend adapter; default `dev_stub` | MDWQ-0102 |
| **Prod KYC** | **DISABLED_BY_FLAG** — mock in CI; prod rejects mock approve | `identity-admin-review.service.ts`, MDWQ-0302/0309 |
| **Prod push (FCM)** | **DISABLED_BY_FLAG** | MDWQ-0508 |
| **Prod rate limit (Redis)** | **FOUNDATION_ONLY** | MDWQ-0104 |
| **Billing / checkout** | **OWNER_DEFERRED** — excluded from this unfinished list per owner direction | D-08, MDWQ-0801, 1001 |

---

### A.5 Schema migration status (Neon — audited, not migrated)

**Command:** `npm run db:neon:health` (2026-10-29).

| Catalog | Applied count | Repo migrations (22) | Gap |
|---|---|---|---|
| **`strangeup_test`** | **22** | Current | None — includes 028C, 028G, 027E join mode |
| **`strangeup_dev`** | **20** | Missing **2** | `20261029170000_task028c_personal_meetup_invitation`, `20261029180000_task028g_meetup_notifications` |

**Impact:** Local/dev exercise of meetup invite APIs against **`strangeup_dev`** will fail until ops runs `npm run db:neon:migrate` (or equivalent) on dev — **not executed in Task 030**.

---

### A.6 Meetup capability & admin-review dependencies

| Item | Dependency | Status |
|---|---|---|
| **`capabilities.meetupInvites: DEFERRED`** | Owner sign-off (`TASK_028H_OWNER_SIGNOFF_CHECKLIST.md`) | Backend routes **exist**; Flutter should hide or gate on capability + product decision |
| **Meetup HTTP** | Task 022 home access + KYC on accept | **IMPLEMENTED** — no additional admin-review endpoint required for meetups |
| **Admin approve queue** | Provider webhook → `adminReviewStatus=PENDING` + session binding | **IMPLEMENTED** — approve requires `identityVerificationSessionId === adminReviewVerificationSessionId` and trusted KYC |
| **Dev catalog** | 028C/028G migrations on target DB | **strangeup_test** OK; **strangeup_dev** pending |

---

### A.7 Security / integration regression notes

| Topic | Finding |
|---|---|
| **Task 027E host approval** | Security audit **PASS** with added suite `activity-join-approval-027e-security.integration.test.ts` (`TASK_027E_SECURITY_VERIFICATION_AUDIT.md`). Not re-run in every later task — full suite still MDWQ-0099. |
| **Group socket eviction** | **IMPLEMENTED** in source: `onUserLeftGroup` → `evictUserFromGroupChat` on voluntary leave **and** moderator remove (029D fix). **Gap:** no dedicated Neon integration asserting socket disconnect on remove (029H). |
| **Session revocation → sockets** | Documented in 023B hardening (`CURRENT_APIS.md`, handoff). |
| **Staff suspend → sockets** | **`applyAccountRestrictionSideEffects` exported**; **no REST writer** to set `suspendedAt` (MDWQ-0507). |
| **Admin cannot bypass KYC** | Approve path checks `hasTrustedKycForEnforcement`, session APPROVED, session ID match; prod blocks mock provider (`identity-admin-review.service.ts`). |
| **Concurrent admin review** | Optimistic `updateMany` on `PENDING` → **409** on conflict; idempotency keys on decisions. |

---

### A.8 Reconciliation with MASTER_DEFERRED_WORK_QUEUE.md

- Task 030 **does not** mark any open MDWQ row as COMPLETED without new verification.
- **New row added:** **MDWQ-0310** — `strangeup_dev` migration drift (028C/028G).
- **MDWQ-0206** reframed: Admin Panel UI → **Task 031** (APIs remain FOUNDATION_ONLY for UI purposes).
- Task **029** closure claims (**029H**) stand; skipped **029E/029G** rows remain **open**.
- Task **028H** backend complete **within scope**; capability deferral unchanged.
- **No invention** of full Figma parity or production readiness.

---

## Part B — Admin panel readiness (Task 022 reuse)

See dedicated matrix: **`ADMIN_PANEL_API_READINESS_MATRIX.md`**.

**Architecture recommendation:** Separate **React + TypeScript** SPA (Vite or Next static export), own repository/workspace, deployed to a **private origin** (VPN or IP allowlist). Authenticates with **same** `POST /v1/auth/login` → Bearer JWT. Authorization = active `PlatformStaffGrant` **`IDENTITY_REVIEWER`**. Calls **`/v1/admin/identity-reviews/*` only** for MVP — do **not** expose mock webhook or bypass Veriff.

**Optional phase 2 (same repo):** `STORE_CATALOG_MANAGER` routes when `STORE_CATALOG_MANAGEMENT_ENABLED=true` — orthogonal to KYC review.

**Security principles for Task 031:**

- No service account that skips KYC binding on approve.
- Display **masked email** only; never expect ID/selfie bytes from API (by design).
- Handle **409/403** with refresh detail + queue reload (concurrent reviewers).
- Store **`Idempotency-Key`** per approve/reject click (UUID).
- CORS: add Admin Panel origin to backend `CORS_ORIGINS` in staging.

---

## Part C — Prioritized execution plan (summary)

Full checklist: **`BACKEND_REMAINING_WORK_CHECKLIST.md`**.  
**Task 031** admin phases: §5 of that file.

| Priority | Theme |
|---|---|
| **P0** | Dev migration parity, staff grants, Admin Panel MVP (031), staging E2E auth→KYC→admin→home |
| **P1** | Release blockers 0099–0103, suspend API, consent strict, prod adapters, deletion/reporting decisions |
| **P2** | Figma optional metrics, badges, geo, ACT-NOTIFY, etc. |
| **OWNER_DEFERRED** | Checkout, billing, OAuth, phone OTP, Veriff live (until authorized), E2EE, D-06 interactive media LIVE |

---

## Deliverables index (Task 030)

| # | Artifact |
|---|---|
| 1 | This report |
| 2 | `ADMIN_PANEL_API_READINESS_MATRIX.md` |
| 3 | `BACKEND_REMAINING_WORK_CHECKLIST.md` (+ Task 031 phases) |
| 4 | Task 031 phases (in checklist §5) |
| 5 | Updated `MASTER_DEFERRED_WORK_QUEUE.md`, `STATUS.md` |

---

## STOP — owner review

Task 030 is **audit-only**. No implementation authorized until owner selects **Task 031** (Admin Panel) and/or specific P0/P1 backend items from the checklist.
