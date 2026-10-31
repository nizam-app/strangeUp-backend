# StrangeUp backend deferred work

**Created:** 2026-10-31 (Task 034 — documentation / tracking only)  
**Scope:** Backend APIs, business logic, migrations, integrations, and owner-gated product work.  
**Companion files:** [ADMIN_DEFERRED_WORK.md](../../../strangeUp-admin-panel/docs/ADMIN_DEFERRED_WORK.md) · [STRANGEUP_COMPLETION_TRACKER.md](../../../cursor_tasks/STRANGEUP_COMPLETION_TRACKER.md)

This file does **not** replace established registers. It indexes incomplete work and links to the evidence already recorded.

| Existing register | Role |
|---|---|
| [MASTER_DEFERRED_WORK_QUEUE.md](./MASTER_DEFERRED_WORK_QUEUE.md) | Historical MDWQ IDs for Tasks 001–030 |
| [ACTIVE_SCOPE_AND_DEFERRALS.md](./ACTIVE_SCOPE_AND_DEFERRALS.md) | Canonical active-scope tracker through Task 030 |
| [STATUS.md](./STATUS.md) | Chronological completion narrative through Task 033E |
| [OPEN_QUESTIONS.md](../product/OPEN_QUESTIONS.md) | Owner decision register (`D-*`, `MKT-*`, `SET-*`, `ACT-*`) |
| [ADMIN_PANEL_API_READINESS_MATRIX.md](./ADMIN_PANEL_API_READINESS_MATRIX.md) | Admin API vs UI capability matrix |
| [CURRENT_APIS.md](../api/CURRENT_APIS.md) | Live vs planned routes |
| [FLUTTER_DEVELOPER_HANDOFF.md](../api/FLUTTER_DEVELOPER_HANDOFF.md) | Flutter contract + deferred capabilities |

**Update rule:** When a later task discovers or closes a gap, update this file and the master tracker in the same change set. Never silently drop an open row. Mark `VERIFIED_COMPLETE` only after the acceptance criteria below are met — a rendered page or a green unit suite is not enough.

---

## Status and priority legend

| Current state | Meaning |
|---|---|
| `NOT_STARTED` | No approved implementation in source |
| `PARTIAL` | Foundation, flag, or subset exists; required behavior incomplete |
| `CODE_COMPLETE_UNTESTED` | Writers/UI exist; required sandbox or production verification is still open |
| `BLOCKED` | Engineering cannot finish without a dependency that is not available |
| `DEFERRED` | Explicitly out of current authorized scope |
| `VERIFIED_COMPLETE` | Acceptance criteria met on the stated environment |

| Priority | Meaning |
|---|---|
| `P0 RELEASE_BLOCKER` | Must be resolved or explicitly accepted as launch risk before production |
| `P1 CORE` | Required for a complete staff or member workflow once the owning module is in scope |
| `P2 ENHANCEMENT` | Optional, Figma-only, or future product work pending approval |

Sections:

- **A.** Confirmed missing or incomplete backend work
- **B.** Policy / owner decisions needed
- **C.** Testing / deployment-only gaps
- **D.** Optional or future enhancements

Do not treat Section D Figma concepts as mandatory product requirements.

---

## Current release states (verified against docs; this task did not inspect live catalogs)

| Surface | Last reported state | Evidence | Qualification |
|---|---|---|---|
| Verification (manual KYC + Cloudinary) | **Sandbox functional sign-off** (031J-2A). Production and Flutter still pending. | [MANUAL_KYC_TEST_RUNTIME.md](../operations/MANUAL_KYC_TEST_RUNTIME.md), [MANUAL_KYC_CLOUDINARY_EVIDENCE.md](../operations/MANUAL_KYC_CLOUDINARY_EVIDENCE.md) | `37/37` smoke; Admin `:5174` evidence inspector. Veriff path inactive. |
| Users Management | **Sandbox functional sign-off** (032E). Dev/production migration and `SUPER_ADMIN` rollout pending. | [STATUS.md](./STATUS.md) Task 032E; [CURRENT_APIS.md](../api/CURRENT_APIS.md) Users section | Isolated `:3010` / `:3011` / `:5174` on `strangeup_test`. |
| Activities List / Details | **Populated sandbox verified** (033C). | [STATUS.md](./STATUS.md) Task 033C | 36 seeded activities; list/filters/pagination/CSV/details. |
| Activities admin cancellation | **Code complete; audit migration applied to `strangeup_test`; live cancel E2E pending.** | [STATUS.md](./STATUS.md) Task 033E; `admin-activity-cancellation.service.ts` | Unit tests exist. 033E applied schema only — **no cancel writes**. |
| Neon `strangeup_test` | **28/28 migrations** last reported. | STATUS 033E; MANUAL_KYC_TEST_RUNTIME | Includes `032c` and `033d`. Not re-inspected in Task 034. |
| Neon `strangeup_dev` | **23 migrations** last reported. | STATUS 033E | Missing later admin/KYC/moderation migrations. Not re-inspected. |
| Production | **Not inspected.** No production URL in this workspace. | STATUS 033E | Do not invent migration status. |
| Veriff | **Code preserved, inactive.** Future activation deferred. | STATUS 031I-1; `VERIFF_LIVE_CALLS_ENABLED=false` | Mocked tests only. |
| Cloudinary manual evidence | **Sandbox tested.** | MANUAL_KYC_TEST_RUNTIME 031J-2A | Authenticated upload/download/destroy on sandbox folder. |
| Admin dashboard aggregations | **Sandbox verified** (035A). Premium, revenue, retention, and Groups/Reports/Transactions feeds return explicit `available: false`. | [CURRENT_APIS.md](../api/CURRENT_APIS.md) Admin dashboard; BE-061–066 | Isolated `:3010` / `strangeup_test`. Read-only. No `strangeup_dev` writes. |

**Inferred `strangeup_dev` gap (not live-verified here):** if the catalog is still 23/28, the five repo migrations after `20261030104500_super_admin_platform_staff_role` are the likely remainder: `031f1`, `031f1b2`, `031im1`, `032c`, `033d`.

---

## A. Confirmed missing or incomplete work

### BE-001 — `strangeup_dev` migration parity

| Field | Value |
|---|---|
| **Module** | Database / operations |
| **Feature / expected behavior** | Dev catalog has the same 28 Prisma migrations as the repo and `strangeup_test`. |
| **Current state** | `PARTIAL` |
| **Priority** | `P0 RELEASE_BLOCKER` |
| **Evidence** | [STATUS.md](./STATUS.md) 033E; `prisma/migrations/` (28 folders); [MASTER_DEFERRED_WORK_QUEUE.md](./MASTER_DEFERRED_WORK_QUEUE.md) MDWQ-0310 (superseded count) |
| **Missing work / acceptance criteria** | Owner-authorized migrate of remaining admin/KYC/moderation migrations on `strangeup_dev` only. Health check reports 28/28. No production writes. |
| **Dependencies** | Owner ops authorization; Neon `strangeup_dev` credentials |
| **Required authorization / migration / test data** | `20261030150000_task031f1_internal_review_hold_notes`; `20261030160000_task031f1b2_admin_review_idempotency_reservation`; `20261030180000_task031im1_manual_kyc_cloudinary_evidence`; `20261031120000_task032c_account_moderation_decision`; `20261031140000_task033d_activity_moderation_decision` |
| **Proposed next implementation task** | Owner-gated ops migrate-dev (do not use the integration-only launcher) |
| **Verification required** | Live `current_database()='strangeup_dev'` + migration catalog 28/28 |

### BE-002 — Production transactional email

| Field | Value |
|---|---|
| **Module** | Auth / notifications |
| **Feature / expected behavior** | Verification, password reset, and email-change mail deliver through a production ESP. |
| **Current state** | `PARTIAL` (`dev_stub` default; Resend adapter ready) |
| **Priority** | `P0 RELEASE_BLOCKER` |
| **Evidence** | MDWQ-0102 / 0204; Tasks 019 / 019B; [FLUTTER_DEVELOPER_HANDOFF.md](../api/FLUTTER_DEVELOPER_HANDOFF.md) env table |
| **Missing work / acceptance criteria** | `TRANSACTIONAL_EMAIL_MODE=provider` with Resend secrets; inbox delivery proven on staging; production fail-closed remains until secrets exist. |
| **Dependencies** | SET-01; owner deploy secrets |
| **Required authorization / migration / test data** | Resend API key; `PUBLIC_APP_BASE_URL` |
| **Proposed next implementation task** | Staging email activation after SET-01 |
| **Verification required** | Real inbox for verify + reset + (when enabled) email change |

### BE-003 — Production media object storage

| Field | Value |
|---|---|
| **Module** | Media |
| **Feature / expected behavior** | Avatars, activity/group covers, and store images use non-local private object storage in production. |
| **Current state** | `PARTIAL` (`MEDIA_STORAGE_BACKEND=local` default; S3 adapter exists) |
| **Priority** | `P0 RELEASE_BLOCKER` |
| **Evidence** | MDWQ-0103 / 0810; Task 020; [MEDIA_OBJECT_STORAGE.md](../operations/MEDIA_OBJECT_STORAGE.md) |
| **Missing work / acceptance criteria** | Owner-approved bucket; production env uses `s3`; buyer store images no longer depend on local fallback. |
| **Dependencies** | Owner bucket approval |
| **Required authorization / migration / test data** | S3-compatible credentials; no schema change required |
| **Proposed next implementation task** | Staging S3 cutover |
| **Verification required** | Upload + authenticated GET on staging; production fail-closed check |

### BE-004 — Counsel ACTIVE consent version IDs

| Field | Value |
|---|---|
| **Module** | Consent / compliance |
| **Feature / expected behavior** | Production `CONSENT_ENFORCEMENT=strict` with counsel-published ACTIVE version IDs. |
| **Current state** | `PARTIAL` (registry live; legal IDs pending) |
| **Priority** | `P0 RELEASE_BLOCKER` |
| **Evidence** | MDWQ-0101; ADR-004; [OPEN_QUESTIONS.md](../product/OPEN_QUESTIONS.md); `.env.example` |
| **Missing work / acceptance criteria** | Legal ACTIVE IDs recorded; production rejects unknown/placeholder versions. |
| **Dependencies** | Legal / counsel |
| **Required authorization / migration / test data** | Counsel document versions; no invented IDs |
| **Proposed next implementation task** | Consent production cutover after legal sign-off |
| **Verification required** | Register + job-apply reject stale versions under `strict` |

### BE-005 — Destructive account deletion

| Field | Value |
|---|---|
| **Module** | Settings / account lifecycle |
| **Feature / expected behavior** | Owner-approved deletion or deactivation workflow with retention, group ownership, and legal-hold rules. |
| **Current state** | `NOT_STARTED` (impact API only; `DELETE /v1/me/account` planned) |
| **Priority** | `P0 RELEASE_BLOCKER` |
| **Evidence** | MDWQ-1101; SET-03; [CURRENT_APIS.md](../api/CURRENT_APIS.md) PLANNED; Task 015 |
| **Missing work / acceptance criteria** | Policy recorded, then DELETE (or deactivate) route, grace period, and content handling. Impact API today returns `AWAITING_POLICY`. |
| **Dependencies** | SET-03 owner decision (DEC-017) |
| **Required authorization / migration / test data** | Retention/legal-hold policy; likely schema for tombstones |
| **Proposed next implementation task** | Account-deletion implementation after SET-03 |
| **Verification required** | Neon + staging deletion journey; no orphaned PII beyond policy |

### BE-006 — Admin activity create and edit APIs

| Field | Value |
|---|---|
| **Module** | Admin activities |
| **Feature / expected behavior** | Staff can create and edit activities through admin APIs if product authorizes that path. Host Flutter create/edit already exists (`/v1/activities`). |
| **Current state** | `NOT_STARTED` for **admin** writers |
| **Priority** | `P1 CORE` |
| **Evidence** | [CURRENT_APIS.md](../api/CURRENT_APIS.md) “Not implemented: create…”; `admin.routes.ts` (GET + cancel only); Figma Activities List “Create Activity” |
| **Missing work / acceptance criteria** | Owner decides whether admin create/edit is required (vs host-only). If yes: DTOs, RBAC, audit, validation, and no host impersonation. |
| **Dependencies** | Owner product decision; Admin UI ADM-010 |
| **Required authorization / migration / test data** | Role + audit policy; probably reuse host activity schema |
| **Proposed next implementation task** | Admin activity writers (only after owner approval) |
| **Verification required** | Staff create/edit on sandbox with audit rows; host Flutter path unchanged |

### BE-007 — Activity cancel host / participant notifications

| Field | Value |
|---|---|
| **Module** | Activities / notifications |
| **Feature / expected behavior** | Administrative (and host) cancellation notifies host and participants. |
| **Current state** | `NOT_STARTED` for notifications. Cancel **records** exist. |
| **Priority** | `P1 CORE` |
| **Evidence** | MDWQ-0706 ACT-NOTIFY; `admin-activity-cancellation.policy.ts` `notificationsSupported: false`; `DETAIL_UNAVAILABLE.cancelNotifications` in `admin-activities.service.ts` |
| **Missing work / acceptance criteria** | Owner-authorized ACT-NOTIFY: in-app (and optionally email/push) events on admin and host cancel; honest DTO flags flip only when delivery is real. |
| **Dependencies** | ACT-NOTIFY; optional MDWQ-0102 / 0508 |
| **Required authorization / migration / test data** | Notification types; no refund coupling |
| **Proposed next implementation task** | Activity cancellation notification emitter |
| **Verification required** | Sandbox cancel creates inbox rows for host + confirmed/waitlisted/pending users |

### BE-008 — Admin users export, phone search, membership filters, bulk APIs

| Field | Value |
|---|---|
| **Module** | Admin users |
| **Feature / expected behavior** | Staff directory supports CSV export, phone search, membership filters, and bulk actions **only if** matching APIs are approved. |
| **Current state** | `NOT_STARTED` for these writers/reads. List/detail/search-by-name/email-prefix/user-ID are live. |
| **Current state note** | Figma shows these controls; they are not invented backend requirements. |
| **Priority** | `P1 CORE` for export if Users module is considered complete; others `P2` until approved |
| **Evidence** | `admin.routes.ts` users routes; `UsersListPage.tsx` copy; no `/v1/admin/users/export` |
| **Missing work / acceptance criteria** | If approved: export cap + injection defenses; phone search policy (masked vs prefix); membership filter after billing exists; bulk mutations with idempotency. |
| **Dependencies** | Owner D-17; billing (DEC-010) for membership filters |
| **Required authorization / migration / test data** | Privacy review for phone search; audit for bulk |
| **Proposed next implementation task** | Users export first, then owner-approved extras |
| **Verification required** | CSV matches list filters; no full email/phone leak |

### BE-009 — Applicant-facing request-more-info

| Field | Value |
|---|---|
| **Module** | Identity review |
| **Feature / expected behavior** | Staff can request more information from an applicant (`NEEDS_MORE_INFO`) with a notification contract. |
| **Current state** | `NOT_STARTED` |
| **Priority** | `P2 ENHANCEMENT` until owner requires it for KYC ops (`P1` if approved) |
| **Evidence** | [ADMIN_PANEL_API_READINESS_MATRIX.md](./ADMIN_PANEL_API_READINESS_MATRIX.md); 022D deferral; distinct from internal hold `NEEDS_FURTHER_REVIEW` (031F-1) |
| **Missing work / acceptance criteria** | Endpoint, applicant notification, Flutter surface, and status semantics. Do not overload internal hold. |
| **Dependencies** | Owner + Flutter |
| **Required authorization / migration / test data** | Status/transition decision; notification type |
| **Proposed next implementation task** | Identity request-more-info after owner approval |
| **Verification required** | Applicant sees next action; Home gate remains correct |

### BE-010 — Manual KYC evidence retention worker

| Field | Value |
|---|---|
| **Module** | Manual KYC / Cloudinary |
| **Feature / expected behavior** | Expired evidence is destroyed in Cloudinary and soft-deleted per `KYC_MANUAL_EVIDENCE_RETENTION_DAYS`. |
| **Current state** | `PARTIAL` (manual DELETE exists; scheduled job deferred) |
| **Priority** | `P1 CORE` |
| **Evidence** | [MANUAL_KYC_CLOUDINARY_EVIDENCE.md](../operations/MANUAL_KYC_CLOUDINARY_EVIDENCE.md); KYC-06 / D-09-retention |
| **Missing work / acceptance criteria** | Ops job or worker; legal retention window; audit of destroys. |
| **Dependencies** | DEC-024 legal retention |
| **Required authorization / migration / test data** | Retention days; sandbox Cloudinary folder |
| **Proposed next implementation task** | Evidence retention worker |
| **Verification required** | Expired sandbox assets destroyed; metadata `deletedAt` set |

### BE-011 — Manual KYC `IN_REVIEW` visibility on admin queue

| Field | Value |
|---|---|
| **Module** | Identity review / manual KYC |
| **Feature / expected behavior** | Staff can find manual Step A (`IN_REVIEW`) applicants from the Verification list without a deep link. |
| **Current state** | `PARTIAL` |
| **Priority** | `P1 CORE` |
| **Evidence** | [MANUAL_KYC_TEST_RUNTIME.md](../operations/MANUAL_KYC_TEST_RUNTIME.md) 031J-2A: Pending tab uses provider-approved queue criteria; manual Step A expected empty until identity APPROVED |
| **Missing work / acceptance criteria** | Owner-approved list criteria for manual authority (separate tab or posture) without mixing Veriff and manual incorrectly. |
| **Dependencies** | Admin ADM-004; identity-list query |
| **Required authorization / migration / test data** | Manual sandbox fixtures |
| **Proposed next implementation task** | Identity list eligibility for manual `IN_REVIEW` |
| **Verification required** | Manual Step A appears in an honest queue; provider PENDING unchanged |

### BE-012 — Activity moderation decision history on detail DTO

| Field | Value |
|---|---|
| **Module** | Admin activities |
| **Feature / expected behavior** | Staff can read persisted `ActivityModerationDecision` rows on activity detail (not only created/published/cancelled timestamps). |
| **Current state** | `PARTIAL` |
| **Priority** | `P1 CORE` |
| **Evidence** | Table from `20261031140000_task033d_activity_moderation_decision`; `DETAIL_UNAVAILABLE.auditHistory = "No server-side activity audit log exists."` in `admin-activities.service.ts` (stale vs 033D) |
| **Missing work / acceptance criteria** | Paginated or recent decision list on GET detail; update `unavailable.auditHistory` so it does not deny a table that exists. Full Figma audit UI is ADM-018. |
| **Dependencies** | 033D migration on the target catalog |
| **Required authorization / migration / test data** | `ActivityModerationDecision` present; cancel fixture |
| **Proposed next implementation task** | Admin activity audit-history read API |
| **Verification required** | After a real cancel, detail returns the decision row |

### BE-013 — Production FCM push delivery

| Field | Value |
|---|---|
| **Module** | Notifications / push |
| **Feature / expected behavior** | Device push delivers from `PushNotificationOutbox` in production. |
| **Current state** | `PARTIAL` (`PUSH_ENABLED=false`; adapter + outbox exist) |
| **Priority** | `P0 RELEASE_BLOCKER` if push is a launch claim; otherwise owner-accepted risk |
| **Evidence** | MDWQ-0508; Task 023D; [PUSH_DELIVERY_TASK023D.md](../operations/PUSH_DELIVERY_TASK023D.md) |
| **Missing work / acceptance criteria** | Firebase creds; `PUSH_ENABLED=true` on staging then production; stale/dedupe already coded. |
| **Dependencies** | D-18; owner Firebase project |
| **Required authorization / migration / test data** | Outbox migration already in repo |
| **Proposed next implementation task** | Staging FCM activation |
| **Verification required** | Real device notification from a known event |

### BE-014 — Production email-change confirm flow

| Field | Value |
|---|---|
| **Module** | Settings |
| **Feature / expected behavior** | Members can change email in production with reauth and notification. |
| **Current state** | `PARTIAL` (DEV_ONLY; production `403 FEATURE_DISABLED`) |
| **Priority** | `P1 CORE` |
| **Evidence** | MDWQ-1103; SET-01; Task 018 gates |
| **Missing work / acceptance criteria** | Enable only after BE-002 + SET-01; production no longer fail-closed for this route. |
| **Dependencies** | BE-002, SET-01 |
| **Required authorization / migration / test data** | ESP + challenge TTL policy |
| **Proposed next implementation task** | Production email-change enablement |
| **Verification required** | Staging change + old-email notice + session revocation per SET-01 |

### BE-015 — Meetup invites product capability still DEFERRED

| Field | Value |
|---|---|
| **Module** | Personal meetup invitations |
| **Feature / expected behavior** | Flutter may treat `capabilities.meetupInvites` as LIVE after owner sign-off. |
| **Current state** | `CODE_COMPLETE_UNTESTED` for REST/notifications; capability **DEFERRED** |
| **Priority** | `P1 CORE` |
| **Evidence** | Task 028H; MDWQ-0506; handoff §13A; `capabilities.meetupInvites` |
| **Missing work / acceptance criteria** | Owner LIVE sign-off; Flutter wiring; no 028F reschedule in this row. |
| **Dependencies** | Owner; Flutter |
| **Required authorization / migration / test data** | 028C+028G on target DB |
| **Proposed next implementation task** | Meetup capability LIVE flag after owner review |
| **Verification required** | Staging create/accept/decline/withdraw + inbox events |

### BE-016 — Store catalog production enablement

| Field | Value |
|---|---|
| **Module** | Marketplace / store catalog |
| **Feature / expected behavior** | Trusted operators can manage catalog in production when MKT-01/02 are approved. |
| **Current state** | `PARTIAL` (`STORE_CATALOG_MANAGEMENT_ENABLED=false`; production fail-closed) |
| **Priority** | `P1 CORE` for merch ops; not required for KYC MVP |
| **Evidence** | MDWQ-0805; Task 024B; `production-env-policy.ts` |
| **Missing work / acceptance criteria** | Owner MKT-01/02; flag on; `STORE_CATALOG_MANAGER` grants; Admin marketplace UI (ADM-040). |
| **Dependencies** | DEC-014/MKT-01/02 |
| **Required authorization / migration / test data** | Role grant; media backend |
| **Proposed next implementation task** | Catalog production enablement after MKT decisions |
| **Verification required** | Staging publish/archive/stock with concurrency |

### BE-017 — Internal review note redaction

| Field | Value |
|---|---|
| **Module** | Identity review |
| **Feature / expected behavior** | Staff can redact internal notes under a retention policy. |
| **Current state** | `NOT_STARTED` (GET/POST notes live after 031F-1) |
| **Priority** | `P2 ENHANCEMENT` |
| **Evidence** | Readiness matrix “redaction route deferred”; `identity-admin-review.controller.ts` |
| **Missing work / acceptance criteria** | Redact/delete route + legal policy; no silent overwrite of audit decisions. |
| **Dependencies** | Retention policy |
| **Required authorization / migration / test data** | 031F-1 migration |
| **Proposed next implementation task** | Note redaction after legal review |
| **Verification required** | Redacted note hidden from later readers; audit preserved |

### BE-018 — Durable batch-decide audit row

| Field | Value |
|---|---|
| **Module** | Identity review |
| **Feature / expected behavior** | A batch approve/reject request is reconstructable as one payload, not only per-applicant idempotency keys. |
| **Current state** | `PARTIAL` |
| **Priority** | `P2 ENHANCEMENT` |
| **Evidence** | [STATUS.md](./STATUS.md) 031H-2 limitation; `identity-admin-review-batch.ts` |
| **Missing work / acceptance criteria** | Optional `IdentityAdminReviewBatch` (or equivalent) storing `batchRequestId` + fingerprint. |
| **Dependencies** | None for current 10-item non-atomic behavior |
| **Required authorization / migration / test data** | New table if approved |
| **Proposed next implementation task** | Batch audit persistence |
| **Verification required** | Replay and compliance export of a full batch |

### BE-019 — Platform staff grant management API

| Field | Value |
|---|---|
| **Module** | Roles / authorization |
| **Feature / expected behavior** | Controlled grant/revoke of `IDENTITY_REVIEWER`, `SUPER_ADMIN`, `STORE_CATALOG_MANAGER` without ad-hoc SQL (or an approved ops-only tool). |
| **Current state** | `NOT_STARTED` for HTTP; SQL runbook exists |
| **Priority** | `P1 CORE` for production ops |
| **Evidence** | [PLATFORM_STAFF_PROVISIONING.md](../operations/PLATFORM_STAFF_PROVISIONING.md); readiness matrix “grants via SQL” |
| **Missing work / acceptance criteria** | Owner-approved ops path; never a public bootstrap; production env bootstrap IDs remain forbidden. |
| **Dependencies** | D-17 |
| **Required authorization / migration / test data** | Existing `PlatformStaffGrant` |
| **Proposed next implementation task** | Staff-grant ops API or signed runbook automation |
| **Verification required** | Grant/revoke audited; production bootstrap env still fail-closed |

### BE-020 — Socket.IO Redis cluster adapter

| Field | Value |
|---|---|
| **Module** | Messaging / realtime |
| **Feature / expected behavior** | Multi-instance Socket.IO shares rooms and account-restriction evictions. |
| **Current state** | `PARTIAL` (flag off; startup fails if enabled without adapter) |
| **Priority** | `P1 CORE` for horizontal scale |
| **Evidence** | MDWQ-0509; Task 023B–D; `production-env-policy.ts` |
| **Missing work / acceptance criteria** | Adapter implementation + security review; do not reuse rate-limit Redis without review. |
| **Dependencies** | Infra review |
| **Required authorization / migration / test data** | Dedicated Redis |
| **Proposed next implementation task** | Socket Redis adapter |
| **Verification required** | Two API instances; suspend evicts sockets on both |

### BE-021 — Checkout, orders, payments, tax, refunds

| Field | Value |
|---|---|
| **Module** | Marketplace / physical commerce |
| **Feature / expected behavior** | Chargeable checkout with reservations, tax, refunds, and fulfillment. |
| **Current state** | `DEFERRED` (`checkout.status=UNAVAILABLE`; 024D TS contracts only) |
| **Priority** | `P0 RELEASE_BLOCKER` **only if** store checkout is a launch claim; otherwise owner-deferred |
| **Evidence** | MDWQ-0801/0802/0806; MKT-03; ADR-003 |
| **Missing work / acceptance criteria** | Do not implement until MKT-03. Then Prisma orders + 024E webhooks. |
| **Dependencies** | DEC-014 |
| **Required authorization / migration / test data** | Processor + tax policy |
| **Proposed next implementation task** | 024E after MKT-03 |
| **Verification required** | Paid sandbox order + refund path |

### BE-022 — Jobs publish and employer delivery

| Field | Value |
|---|---|
| **Module** | Jobs |
| **Feature / expected behavior** | Authorized publishers post jobs; applications reach employers. |
| **Current state** | `NOT_STARTED` for publish HTTP; applications in-platform only (`employerDelivery.status=NOT_CONFIGURED`) |
| **Priority** | `P1 CORE` for Jobs go-live |
| **Evidence** | MDWQ-0901/0902/0905; Task 029G skipped |
| **Missing work / acceptance criteria** | JOB-01 publisher model; JOB-02 delivery; withdrawal/transitions if approved. |
| **Dependencies** | DEC-015 |
| **Required authorization / migration / test data** | Publisher role |
| **Proposed next implementation task** | 029G after owner authorization |
| **Verification required** | Publish + apply + employer receipt |

### BE-023 — Membership billing and Club entitlements

| Field | Value |
|---|---|
| **Module** | Membership |
| **Feature / expected behavior** | Paid Club, trials, restore, and enforceable benefits. |
| **Current state** | `DEFERRED` (D-08 2026-10-28) |
| **Priority** | `P0 RELEASE_BLOCKER` only if paid Club is a launch claim |
| **Evidence** | MDWQ-1001–1004; [D-08-owner-defer-billing-2026-10-28.md](../decisions/D-08-owner-defer-billing-2026-10-28.md) |
| **Missing work / acceptance criteria** | Do not start 026B+ until billing is re-authorized. |
| **Dependencies** | DEC-010 |
| **Required authorization / migration / test data** | Ledger schema after re-auth |
| **Proposed next implementation task** | 026B subscription ledger (no payments) only after owner re-auth |
| **Verification required** | Honest `flow` remains until charges exist |

### BE-024 — Group owner invitations

| Field | Value |
|---|---|
| **Module** | Groups |
| **Feature / expected behavior** | Owner/moderator invites a member (distinct from join request). |
| **Current state** | `NOT_STARTED` |
| **Priority** | `P1 CORE` for Header/Groups Figma if approved |
| **Evidence** | MDWQ-0505; Header parity; D-GROUPS |
| **Missing work / acceptance criteria** | Invite create/accept/decline; not a join-request reuse. |
| **Dependencies** | D-GROUPS owner decision |
| **Required authorization / migration / test data** | Invitation table |
| **Proposed next implementation task** | Group invitations after owner approval |
| **Verification required** | Invitee Home/inbox; archived group guards |

### BE-025 — D-06 interactive group media production activation

| Field | Value |
|---|---|
| **Module** | Groups / community media |
| **Feature / expected behavior** | Stories, photo posts, and polls are LIVE (flag on) and Home stories are no longer `DEFERRED`. |
| **Current state** | `DEFERRED` (`GROUP_COMMUNITY_INTERACTIVE_ENABLED=false`; 029E skipped) |
| **Priority** | `P0 RELEASE_BLOCKER` only if stories are a launch claim |
| **Evidence** | MDWQ-0601/0602; Task 016; D-06 |
| **Missing work / acceptance criteria** | D06-01..07 sign-off; production media/moderation; Home row contract. |
| **Dependencies** | DEC-013 |
| **Required authorization / migration / test data** | Task 016 schema already present |
| **Proposed next implementation task** | D-06 activation (not 029E revival without owner) |
| **Verification required** | Flag-on staging; Home hides stories until status leaves `DEFERRED` |

---

### BE-061 — Authoritative premium / Club membership purchase records

| Field | Value |
|---|---|
| **Module** | Membership / Admin dashboard |
| **Feature / expected behavior** | Durable purchase or entitlement rows that can power a Premium KPI. |
| **Current state** | `DEFERRED` (membership catalog is read-only `flow`; no settled purchase ledger) |
| **Priority** | `P1 CORE` only if Club billing is a launch claim |
| **Evidence** | Task 026A; DEC-010; `GET /v1/admin/dashboard/overview` returns `premium.available=false` |
| **Missing work / acceptance criteria** | Do not invent paid-member counts. Implement only after authorized billing records exist. |
| **Dependencies** | DEC-010, BE-023, BE-054 |
| **Required authorization / migration / test data** | Billing schema not authorized in 035A |
| **Proposed next implementation task** | None until Club billing is owner-authorized |
| **Verification required** | Dashboard Premium card stays Unavailable with reason until then |

---

### BE-062 — Settled payment / order ledger for Revenue KPI

| Field | Value |
|---|---|
| **Module** | Payments / Admin dashboard |
| **Feature / expected behavior** | Settled payment or order records with currency and range semantics for a Revenue KPI. |
| **Current state** | `DEFERRED` (no charge APIs; checkout UNAVAILABLE) |
| **Priority** | `P0 RELEASE_BLOCKER` only if revenue is a launch claim |
| **Evidence** | BE-021; `GET /v1/admin/dashboard/overview` returns `revenue.available=false` |
| **Missing work / acceptance criteria** | Do not invent monthly revenue, MRR, or Figma $124,550. Currency and settlement status must be real. |
| **Dependencies** | DEC-010, BE-021 |
| **Required authorization / migration / test data** | No payment integration in 035A |
| **Proposed next implementation task** | None until checkout is authorized |
| **Verification required** | Dashboard Revenue card stays Unavailable with reason until then |

---

### BE-063 — Last-active / DAU / retention evidence

| Field | Value |
|---|---|
| **Module** | Users / Admin dashboard |
| **Feature / expected behavior** | Durable last-active or session analytics that can power DAU/MAU and a retention series. |
| **Current state** | `NOT_STARTED` (User has `accountStatus` ACTIVE, not last-seen) |
| **Priority** | `P2 ENHANCEMENT` |
| **Evidence** | Prisma `User`; growth `activeUsers.available=false`; overview Active Accounts labeled as account status |
| **Missing work / acceptance criteria** | Do not treat ACTIVE account status as DAU/MAU. Do not fabricate retention %. |
| **Dependencies** | Product decision on session telemetry |
| **Required authorization / migration / test data** | New fields would need an authorized later migration — not 035A |
| **Proposed next implementation task** | None until last-active tracking is approved |
| **Verification required** | Growth chart remains signups + cumulative only |

---

### BE-064 — Durable Groups admin event feed

| Field | Value |
|---|---|
| **Module** | Groups / Admin dashboard |
| **Feature / expected behavior** | Persisted group-creation / membership governance events for Recent Platform Activity. |
| **Current state** | `NOT_STARTED` (no admin groups module; member group APIs are not an admin audit feed) |
| **Priority** | `P1 CORE` only when Groups Admin is in D-17 scope |
| **Evidence** | `GET /v1/admin/dashboard/recent-events?category=groups` returns `available: false` |
| **Missing work / acceptance criteria** | Do not invent group-creation history from `createdAt`. |
| **Dependencies** | ADM-060, DEC-031/032 |
| **Required authorization / migration / test data** | Groups Admin not started (035A restriction) |
| **Proposed next implementation task** | Groups module — do not start from the dashboard |
| **Verification required** | Groups tab stays honest unavailable |

---

### BE-065 — Platform reports & flags event feed

| Field | Value |
|---|---|
| **Module** | Reports / Admin dashboard |
| **Feature / expected behavior** | Persisted harassment / safety report queue events. |
| **Current state** | `NOT_STARTED` (no platform report queue) |
| **Priority** | `P1 CORE` if D-15 reports are a launch claim |
| **Evidence** | DEC-020; `category=reports` returns `available: false` |
| **Missing work / acceptance criteria** | Do not invent urgent/high severity or harassment reports. |
| **Dependencies** | DEC-020, ADM-068 |
| **Required authorization / migration / test data** | Reports module not started |
| **Proposed next implementation task** | Reports — not dashboard |
| **Verification required** | Reports & Flags tab stays honest unavailable |

---

### BE-066 — Transaction / payment event feed

| Field | Value |
|---|---|
| **Module** | Payments / Admin dashboard |
| **Feature / expected behavior** | Persisted transaction events for the Transactions recent-activity tab. |
| **Current state** | `DEFERRED` (same ledger gap as BE-062) |
| **Priority** | `P1 CORE` only if Payments Admin is in scope |
| **Evidence** | `category=transactions` returns `available: false`; ADM-065 |
| **Missing work / acceptance criteria** | Do not invent transaction rows or staff actor names. |
| **Dependencies** | BE-021, BE-062, ADM-065 |
| **Required authorization / migration / test data** | No billing integration |
| **Proposed next implementation task** | None until payments exist |
| **Verification required** | Transactions tab stays honest unavailable |

---

## B. Policy / owner decisions needed

These block implementation or prevent honest product copy. Do not invent statuses, vendors, or refunds.

### DEC-001 — KYC vendor and Veriff activation (KYC-02)

| Field | Value |
|---|---|
| **Module** | KYC |
| **Feature** | Select production identity authority (Veriff live vs continued manual vs both with exclusive flags) |
| **Current state** | `DEFERRED` / `BLOCKED` |
| **Priority** | `P0 RELEASE_BLOCKER` |
| **Evidence** | MDWQ-0301/0302/0309; STATUS 031I-1; `KYC_VENDOR_EVALUATION.md`; Veriff adapter gated |
| **Missing work / AC** | Written KYC-02; sandbox credentials if Veriff; production still fail-closed until authorized |
| **Dependencies** | Vendor contract; counsel |
| **Auth / migration / data** | `VERIFF_*`; never enable live in production without owner |
| **Next task** | Owner KYC-02; optional Veriff sandbox smoke (INT-006) |
| **Verification** | Non-prod live session + webhook; production remains forbidden until signed |

### DEC-002 — Activity admin approval lifecycle

| Field | Value |
|---|---|
| **Module** | Admin activities |
| **Feature** | Figma “Pending Approval” metric / approve-to-publish flow |
| **Current state** | `DEFERRED` |
| **Priority** | `P1 CORE` if product requires staff approval of activities; otherwise do not implement |
| **Evidence** | `unsupportedLifecycleCards.pendingApproval` in `admin-activities.service.ts`; Activity statuses are `DRAFT/PUBLISHED/CANCELLED/COMPLETED` only |
| **Missing work / AC** | Owner says whether a new activity status is required. Do not reuse member `HOST_APPROVAL` join mode. |
| **Dependencies** | Product |
| **Auth / migration / data** | New enum/status if approved |
| **Next task** | Decision record, then schema if yes |
| **Verification** | No fake Pending Approval counts before a real state exists |

### DEC-003 — Activity suspend / freeze policy

| Field | Value |
|---|---|
| **Module** | Admin activities |
| **Feature** | Suspend/freeze distinct from cancel |
| **Current state** | `DEFERRED` |
| **Priority** | `P1 CORE` only if approved |
| **Evidence** | `unsupportedLifecycleCards.suspended`; `DETAIL_UNAVAILABLE.moderationActions` |
| **Missing work / AC** | Define effect on discovery, RSVP, meeting, and sockets. Cancel already exists. |
| **Dependencies** | Product / legal |
| **Auth / migration / data** | New status or flag |
| **Next task** | Policy ADR |
| **Verification** | Discovery/RSVP behavior matches the written rule |

### DEC-004 — Activity permanent delete policy

| Field | Value |
|---|---|
| **Module** | Admin activities |
| **Feature** | Hard-delete an activity and related rows |
| **Current state** | `DEFERRED` |
| **Priority** | `P1 CORE` only if approved |
| **Evidence** | CURRENT_APIS admin activities “Not implemented: … delete”; host cancel preserves participations |
| **Missing work / AC** | Legal hold, participant history, media, and audit retention. Default today is cancel + retain. |
| **Dependencies** | Legal |
| **Auth / migration / data** | Destructive path + audit |
| **Next task** | Policy only until approved |
| **Verification** | No unaudited deletes |

### DEC-005 — Activity / store refund policy

| Field | Value |
|---|---|
| **Module** | Activities / commerce |
| **Feature** | Refunds after cancel |
| **Current state** | `DEFERRED` |
| **Priority** | `P2 ENHANCEMENT` until payments exist |
| **Evidence** | `refundsSupported: false`; MDWQ-0707; MKT-03 |
| **Missing work / AC** | Cannot implement refunds without a payment ledger |
| **Dependencies** | BE-021 / DEC-010 / DEC-014 |
| **Auth / migration / data** | Processor refunds |
| **Next task** | None until billing/checkout authorized |
| **Verification** | No UI that claims refunds were sent |

### DEC-006 — Safety reports and risk scoring

| Field | Value |
|---|---|
| **Module** | Trust & safety |
| **Feature** | Activity/user safety reports and risk scores |
| **Current state** | `NOT_STARTED` |
| **Priority** | `P1 CORE` if D-15 approved; otherwise optional |
| **Evidence** | MDWQ-0607; D-15 OPEN; `DETAIL_UNAVAILABLE.safetyReports/riskScore` |
| **Missing work / AC** | Product/legal SLA; do not invent scores to match Figma widgets |
| **Dependencies** | D-15 |
| **Auth / migration / data** | Report schema if approved |
| **Next task** | D-15 decision |
| **Verification** | Only real stored reports are shown |

### DEC-007 — Location disclosure, map, and GPS verification

| Field | Value |
|---|---|
| **Module** | Activities / discovery |
| **Feature** | Admin/public maps, exact addresses, GPS evidence |
| **Current state** | `DEFERRED` |
| **Priority** | `P0` for member geo (D-04); admin map is policy-gated |
| **Evidence** | MDWQ-0401; D-04; `DETAIL_UNAVAILABLE.map/preciseLocation/gpsVerification`; admin omits meeting instructions by contract |
| **Missing work / AC** | Location policy before any admin precise-address API |
| **Dependencies** | D-04 expansion |
| **Auth / migration / data** | Coordinates + ACL |
| **Next task** | Location policy ADR |
| **Verification** | Staff never receive unapproved meetup instructions |

### DEC-008 — Pricing, tags, and creation-source persistence

| Field | Value |
|---|---|
| **Module** | Activities |
| **Feature** | Admission price, extra tags, web/app/API source |
| **Current state** | `NOT_STARTED` (not stored) |
| **Priority** | `P2 ENHANCEMENT` |
| **Evidence** | `DETAIL_UNAVAILABLE.pricing/tags/createdSource`; activity payments MDWQ-0707 |
| **Missing work / AC** | Owner says these are required before schema work |
| **Dependencies** | Product; payments if priced |
| **Auth / migration / data** | New columns if approved |
| **Next task** | Decision only |
| **Verification** | Admin continues to show Unavailable until stored |

### DEC-009 — Host reviews / trust metrics

| Field | Value |
|---|---|
| **Module** | Activities / users |
| **Feature** | Host star ratings and trust indexes |
| **Current state** | `NOT_STARTED` |
| **Priority** | `P2 ENHANCEMENT` |
| **Evidence** | `DETAIL_UNAVAILABLE.hostReviews`; COPY-TRUST; handoff “no rating fields” |
| **Missing work / AC** | Do not fabricate 4.98-style Figma numbers |
| **Dependencies** | COPY-TRUST / product |
| **Auth / migration / data** | Review model if approved |
| **Next task** | Decision only |
| **Verification** | No invented host score in Admin or Flutter |

### DEC-010 — Billing / Club commercial terms (D-08)

| Field | Value |
|---|---|
| **Module** | Membership |
| **Feature** | Prices, intervals, trials, benefit matrix, lifecycle |
| **Current state** | `DEFERRED` |
| **Priority** | `P0` if Club is sold; else deferred |
| **Evidence** | D-08 checklist in OPEN_QUESTIONS; 2026-10-28 owner deferral |
| **Missing work / AC** | D-08-01..06 answers before 026B |
| **Dependencies** | Commercial sign-off |
| **Auth / migration / data** | None now |
| **Next task** | Owner billing re-authorization |
| **Verification** | APIs stay `NOT_CONFIGURED` until then |

### DEC-011 — OAuth (Apple / Google)

| Field | Value |
|---|---|
| **Module** | Auth |
| **Feature** | Social sign-in |
| **Current state** | `DEFERRED` |
| **Priority** | `P0` if login Figma SSO is a launch claim; approved Phase 1 is email/password |
| **Evidence** | MDWQ-0201; D-02-AUTH |
| **Missing work / AC** | Provider contracts; no Admin SSO either (ADM-001) |
| **Dependencies** | Provider apps |
| **Auth / migration / data** | Identity linking |
| **Next task** | None until owner |
| **Verification** | Existing email/password gate unchanged |

### DEC-012 — Phone collection and SMS OTP

| Field | Value |
|---|---|
| **Module** | Auth / settings |
| **Feature** | Mandatory phone at signup and/or verify/edit write path |
| **Current state** | `DEFERRED` / `NOT_STARTED` |
| **Priority** | `P0` for D-02-phone if chosen |
| **Evidence** | MDWQ-0202/0203; SET-04; Screen 06 |
| **Missing work / AC** | SMS vendor + policy |
| **Dependencies** | SMS contract |
| **Auth / migration / data** | Phone write path |
| **Next task** | D-02-phone decision |
| **Verification** | No fake OTP UI |

### DEC-013 — D-06 community media LIVE

Covered with BE-025. Owner must approve D06-01..07 before flag-on.

### DEC-014 — Marketplace model and checkout (MKT-01..04)

| Field | Value |
|---|---|
| **Module** | Store |
| **Feature** | Official merch vs P2P, trusted publisher, tax/payment/refund, image rights |
| **Current state** | `DEFERRED` / OPEN |
| **Priority** | `P0` for checkout; `P1` for model |
| **Evidence** | OPEN_QUESTIONS MKT-*; MDWQ-0803–0809 |
| **Missing work / AC** | Written MKT decisions before 024E or P2P |
| **Dependencies** | Legal/finance |
| **Auth / migration / data** | Processor |
| **Next task** | MKT-03 if store sales are in scope |
| **Verification** | Checkout remains UNAVAILABLE until then |

### DEC-015 — Jobs publisher and employer channel (JOB-01/02)

Pairs with BE-022. 029G remains skipped, not cancelled.

### DEC-016 — Geo / distance discovery (D-04 expansion)

| Field | Value |
|---|---|
| **Module** | Discovery / jobs / activities |
| **Feature** | Maps, radius, nearest-first, presence |
| **Current state** | `NOT_STARTED` |
| **Priority** | `P0` if maps are a launch claim; MVP is city/region text |
| **Evidence** | MDWQ-0401/0903; D-04 MVP doc |
| **Missing work / AC** | Location policy first |
| **Dependencies** | DEC-007 |
| **Auth / migration / data** | Geo indexes |
| **Next task** | D-04 expansion only after policy |
| **Verification** | No client-side fake distances |

### DEC-017 — Account deletion vs deactivation (SET-03)

Pairs with BE-005. Impact API must stay `AWAITING_POLICY` until recorded.

### DEC-018 — Post-approval admin reversal

| Field | Value |
|---|---|
| **Module** | Identity review |
| **Feature** | Revoke platform activation without provider identity revoke |
| **Current state** | `NOT_STARTED` |
| **Priority** | `P1 CORE` if ops needs it |
| **Evidence** | Readiness matrix “Post-approval admin reversal = NO” |
| **Missing work / AC** | Decision + API; do not PATCH KYC fields |
| **Dependencies** | Owner |
| **Auth / migration / data** | New transition |
| **Next task** | Reversal policy |
| **Verification** | Home access and sessions match the rule |

### DEC-019 — Secret / unlisted private groups

| Field | Value |
|---|---|
| **Module** | Groups |
| **Feature** | Hidden groups vs discoverable `PRIVATE_APPROVAL` summaries |
| **Current state** | `PARTIAL` (private summaries are listed) |
| **Priority** | `P1 CORE` if secrecy is required |
| **Evidence** | MDWQ-0914; D-GROUPS |
| **Missing work / AC** | Owner rule for discovery of private groups |
| **Dependencies** | D-GROUPS |
| **Auth / migration / data** | Visibility flag |
| **Next task** | GRP-DISC-01 |
| **Verification** | Unlisted groups omitted from discover |

### DEC-020 — Abuse reporting SLA (D-15)

| Field | Value |
|---|---|
| **Module** | Trust & safety |
| **Feature** | Platform reporting + moderation SLA |
| **Current state** | `NOT_STARTED` (group content reports exist in Task 016 path) |
| **Priority** | `P1 CORE` |
| **Evidence** | MDWQ-0607; `group-content-report.service.ts`; D-15 OPEN |
| **Missing work / AC** | Platform-wide report APIs and SLA; Admin Reports module (ADM-050) |
| **Dependencies** | D-15 |
| **Auth / migration / data** | Report models |
| **Next task** | D-15 decision |
| **Verification** | No fabricated report counts |

### DEC-021 — E2EE messaging (D-10)

Owner-deferred. Do not claim encryption in Admin or Flutter copy.

### DEC-022 — Meetup reschedule / counter-proposal (028F)

| Field | Value |
|---|---|
| **Module** | Meetup invites |
| **Feature** | Reschedule after send/accept |
| **Current state** | `DEFERRED` |
| **Priority** | `P1` if product wants 028F |
| **Evidence** | MDWQ-0724; Task 028 plan |
| **Missing work / AC** | MEET-RESCHEDULE decision |
| **Dependencies** | D-28 |
| **Auth / migration / data** | State-machine extension |
| **Next task** | 028F after owner |
| **Verification** | Existing five-state MVP unchanged until then |

### DEC-023 — 2FA (SET-05)

Not started. Admin login Figma 2FA is also unwired (ADM-001).

### DEC-024 — KYC metadata retention and deletion (KYC-06)

Legal. Blocks BE-010 production defaults.

### DEC-025 — Two-hour activity edit/cancel cutoff (ACT-CUTOFF)

MDWQ-0703. P2. Host manage APIs exist without this cutoff.

### DEC-026 — Activity category catalog vs Figma (ACT-CATALOG)

MDWQ-0713. Five seeded slugs vs Yoga / Social & Dining.

### DEC-027 — Authoritative Home Screen 08 variant (HOME-08)

MDWQ-0406. API is a superset; stories remain `DEFERRED`.

### DEC-028 — Marketing trust copy (COPY-TRUST)

Do not serve fabricated “100% verified”, host 4.98, or E2EE claims.

### DEC-029 — Admin panel product expectations (D-17)

Which sidebar modules are launch-required vs later.

### DEC-030 — Production SLO / residency (D-19)

MDWQ-0100 companion.

### DEC-031 — Authoritative Group Details Figma (MDWQ-0911)

Original vs updated Screen 15 (Stories/Chat/Meetups).

### DEC-032 — My Groups PDF re-export (MDWQ-0910)

Source packaging error. Visual parity unverified.

### DEC-033 — `FOLLOWERS_ONLY` activity publish (ACT-FOLLOW)

MDWQ-0702. Draft-only storage today.

### DEC-034 — KYC retry / appeal / outage (KYC-04)

MDWQ-0303. Partial ENF bounds only.

### DEC-035 — Legacy email-active admin backfill (ADR-005)

MDWQ-0205. Forward-only policy; ops playbook pending.

---

## C. Testing / deployment-only gaps

### INT-001 — Full isolated Neon integration regression

| Field | Value |
|---|---|
| **Module** | Quality / release |
| **Feature** | Entire integration suite green on `strangeup_test` at the release gate |
| **Current state** | `NOT_STARTED` as a single release run (spot suites only) |
| **Priority** | `P0 RELEASE_BLOCKER` |
| **Evidence** | MDWQ-0099; Tasks 023E/024–026A deferred full regression |
| **Missing work / AC** | CI job + time budget; `npm run test:integration` green |
| **Dependencies** | `strangeup_test` 28/28 |
| **Auth / migration / data** | `RUN_INTEGRATION=1` |
| **Next task** | Release-gate integration job |
| **Verification** | One recorded full-suite run |

### INT-002 — Production deploy topology, secrets, remote, SLO

| Field | Value |
|---|---|
| **Module** | Deployment |
| **Feature** | Documented production topology and secrets |
| **Current state** | `NOT_STARTED` |
| **Priority** | `P0 RELEASE_BLOCKER` |
| **Evidence** | MDWQ-0100; D-19; STATUS “Deployment UNRESOLVED” |
| **Missing work / AC** | Owner deploy authorization; no production URL is in this workspace |
| **Dependencies** | DEC-030 |
| **Auth / migration / data** | Secrets manager |
| **Next task** | Production runbook |
| **Verification** | Staging deploy first; production not invented here |

### INT-003 — Distributed rate-limit production activation

| Field | Value |
|---|---|
| **Module** | Abuse protection |
| **Feature** | Upstash/Redis rate limits live in production |
| **Current state** | `PARTIAL` (adapter ready; memory/default locally) |
| **Priority** | `P1 CORE` |
| **Evidence** | MDWQ-0104; Task 019B |
| **Missing work / AC** | `RATE_LIMIT_REDIS_URL` in production; fail-closed on Redis errors already coded |
| **Dependencies** | Upstash |
| **Auth / migration / data** | Redis URL |
| **Next task** | Staging Redis rate-limit |
| **Verification** | 429 under load; Redis outage fail-closed |

### INT-004 — Live admin activity cancellation E2E

| Field | Value |
|---|---|
| **Module** | Admin activities |
| **Feature** | Real SUPER_ADMIN cancel on sandbox through API + BFF + Admin UI, with audit row and participation close |
| **Current state** | `CODE_COMPLETE_UNTESTED` |
| **Priority** | `P0 RELEASE_BLOCKER` for Activities writers |
| **Evidence** | STATUS 033E “No seed, cleanup, cancel, or E2E writes”; unit tests `admin-activity-cancellation.*.test.ts`; BFF `server/routes/activities.ts` cancel |
| **Missing work / AC** | Isolated `strangeup_test` cancel against a seeded activity; UI success; `ActivityModerationDecision` row; no notifications/refunds claimed |
| **Dependencies** | Temporary SUPER_ADMIN; 033C seed or equivalent |
| **Auth / migration / data** | 033D present (28/28 test) |
| **Next task** | Activities cancel sandbox E2E |
| **Verification** | Browser + API + DB read-back; grant revoked after |

### INT-005 — Dev / production rollout of 032C and 033D

| Field | Value |
|---|---|
| **Module** | Users + Activities writers |
| **Feature** | `AccountModerationDecision` and `ActivityModerationDecision` exist before enabling writers outside `strangeup_test` |
| **Current state** | `PARTIAL` (test only) |
| **Priority** | `P0 RELEASE_BLOCKER` |
| **Evidence** | STATUS 032E / 033E; CURRENT_APIS cancel “503 if table missing” |
| **Missing work / AC** | Owner migrate `strangeup_dev` then production when a production URL exists |
| **Dependencies** | BE-001; production URL (unavailable here) |
| **Auth / migration / data** | 032C, 033D |
| **Next task** | Dev migrate; production migrate only with owner |
| **Verification** | Writers fail-closed until tables exist |

### INT-006 — Veriff live sandbox smoke

| Field | Value |
|---|---|
| **Module** | KYC |
| **Feature** | Optional live Veriff sandbox session + webhook |
| **Current state** | `BLOCKED` (no owner credentials / live flag) |
| **Priority** | `P1 CORE` after DEC-001 |
| **Evidence** | STATUS 031I-1; mocked tests only |
| **Missing work / AC** | Owner `VERIFF_LIVE_CALLS_ENABLED=true` on non-prod only |
| **Dependencies** | DEC-001 |
| **Auth / migration / data** | Veriff sandbox keys + portal webhook |
| **Next task** | Veriff sandbox smoke |
| **Verification** | One non-prod decision webhook; production still fail-closed |

### INT-007 — Staging register → KYC → admin approve → Home

| Field | Value |
|---|---|
| **Module** | Onboarding |
| **Feature** | Repeat 022D journey on a staging URL |
| **Current state** | `NOT_STARTED` for staging URL (sandbox 022D verified on `strangeup_test`) |
| **Priority** | `P0 RELEASE_BLOCKER` |
| **Evidence** | STATUS 022D; BACKEND_REMAINING_WORK_CHECKLIST P0-5 |
| **Missing work / AC** | Staging origin, staff grant, mock or manual KYC |
| **Dependencies** | Staging deploy; staff grant |
| **Auth / migration / data** | Staging catalog current |
| **Next task** | Staging E2E after hosting exists |
| **Verification** | Mobile `GET /v1/home` 200 after approve |

### INT-008 — Admin BFF production session store

| Field | Value |
|---|---|
| **Module** | Admin auth |
| **Feature** | Durable session store (not in-memory) in production |
| **Current state** | `PARTIAL` (memory default; production fails if `SESSION_STORE=memory`) |
| **Priority** | `P0 RELEASE_BLOCKER` for Admin production |
| **Evidence** | [strangeUp-admin-panel/README.md](../../../strangeUp-admin-panel/README.md) |
| **Missing work / AC** | Owner-selected store; same-origin cookie deploy |
| **Dependencies** | INT-002 |
| **Auth / migration / data** | Session backend |
| **Next task** | BFF session-store production design |
| **Verification** | Multi-instance login survives process restart |

### INT-009 — Production catalog inspection

| Field | Value |
|---|---|
| **Module** | Operations |
| **Feature** | Known production migration and data status |
| **Current state** | `NOT_STARTED` / unavailable |
| **Priority** | `P0 RELEASE_BLOCKER` before any production enablement |
| **Evidence** | STATUS 033E “No production URL in this workspace” |
| **Missing work / AC** | Owner provides production access or an exported migration list |
| **Dependencies** | Owner |
| **Auth / migration / data** | None in this repo |
| **Next task** | Production inventory (read-only) when authorized |
| **Verification** | Do not guess |

### INT-010 — Flutter production dependencies

| Field | Value |
|---|---|
| **Module** | Flutter / release |
| **Feature** | External app uses current handoff: optional email verify, manual or provider KYC, deferred meetup/billing/stories flags |
| **Current state** | `PARTIAL` (handoff written; Flutter repo out of scope) |
| **Priority** | `P0 RELEASE_BLOCKER` for member launch |
| **Evidence** | [FLUTTER_DEVELOPER_HANDOFF.md](../api/FLUTTER_DEVELOPER_HANDOFF.md); Task 004 cancelled |
| **Missing work / AC** | Flutter implements LIVE contracts only; hides DEFERRED |
| **Dependencies** | Flutter repo |
| **Auth / migration / data** | None in this workspace |
| **Next task** | Flutter integration against staging |
| **Verification** | No client-side fake approvals, prices, or stories |

### INT-011 — Identity-review integration suites gated

| Field | Value |
|---|---|
| **Module** | Identity review tests |
| **Feature** | 031F/G/H integration files run in CI |
| **Current state** | `PARTIAL` (skipped unless `RUN_INTEGRATION=1`) |
| **Priority** | `P1 CORE` |
| **Evidence** | `tests/integration/admin-identity-review-031*.integration.test.ts`; STATUS 031F–H |
| **Missing work / AC** | Include in INT-001 release gate |
| **Dependencies** | INT-001 |
| **Auth / migration / data** | `strangeup_test` |
| **Next task** | CI integration job |
| **Verification** | Recorded pass counts |

### INT-012 — Production KYC authority path

| Field | Value |
|---|---|
| **Module** | KYC |
| **Feature** | Production issues real identity approvals (manual Cloudinary **or** live vendor) |
| **Current state** | `BLOCKED` |
| **Priority** | `P0 RELEASE_BLOCKER` |
| **Evidence** | MDWQ-0309; production-env-policy fail-closed; Cloudinary tested only on sandbox |
| **Missing work / AC** | DEC-001 + production secrets + BE-001/INT-005 |
| **Dependencies** | DEC-001, BE-003/Cloudinary prod, consent IDs |
| **Auth / migration / data** | 031I-M1 on production |
| **Next task** | Production KYC activation after owner |
| **Verification** | One production-like staging approval; production cutover separately |

---

## D. Optional or future enhancements

Do not schedule these as release blockers without product approval.

| ID | Module | Feature | State | Priority | Evidence | Missing / AC | Dependencies | Next task | Verification |
|---|---|---|---|---|---|---|---|---|---|
| BE-026 | Profile | Custom free-text interests | `NOT_STARTED` | P2 | MDWQ-0402 | Catalog policy | D-03 | Decision | Catalog-only remains default |
| BE-027 | Profile | Cross-user `profileVisibility` beyond D-03 | `PARTIAL` | P1 | MDWQ-0403 | Enforcement rules | D-03 expansion | Visibility enforcement | Public reads match policy |
| BE-028 | Profile | Verified location badge | `NOT_STARTED` | P2 | MDWQ-0404 | Geo/trust | D-04 | Decision | No fake badge |
| BE-029 | Search | Federated header/main search | `NOT_STARTED` | P1 | MDWQ-0405 | Search product | DEC-029 | Search API | Admin topbar remains disabled until then |
| BE-030 | Messaging | Chat photos/attachments | `NOT_STARTED` | P1 | MDWQ-0503 | Media policy | BE-003 | Chat media | Text-only until then |
| BE-031 | Messaging | Mute / archive threads | `NOT_STARTED` | P2 | MDWQ-0504 | Product | — | Decision | — |
| BE-032 | Messaging | Presence | `DEFERRED` | P2 | MDWQ-0502 | Presence model | — | None | No online dots |
| BE-033 | Notifications | Group-chat push (`groupChatEnabled` default false) | `PARTIAL` | P2 | MDWQ-0510 | Group notif policy | BE-013 | Decision | In-app only until then |
| BE-034 | Notifications | In-app retention period | `PARTIAL` | P2 | MDWQ-0513; 365-day constant | Legal | D-18-retention | Legal review | — |
| BE-035 | Notifications | Marketing email notifications | `DEFERRED` | P2 | MDWQ-0514 | ESP + product | D-18 | None | — |
| BE-036 | Groups | Personal “Your Story” | `NOT_STARTED` | P2 | MDWQ-0603 | D06-04 | DEC-013 | None | — |
| BE-037 | Groups | Story expiry worker | `PARTIAL` | P2 | MDWQ-0604 | Scheduled cleanup | Ops | Worker | Manual script not enough |
| BE-038 | Groups | Verified Community badge | `NOT_STARTED` | P2 | MDWQ-0605 | Trust policy | — | Decision | — |
| BE-039 | Feed | Photo/poll/share bodies | `NOT_STARTED` | P1 | MDWQ-0606 | D-06 | BE-025 | After D-06 | Text posts only |
| BE-040 | Activities | Completion/archival automation | `PARTIAL` | P2 | MDWQ-0705 | ACT-COMPLETED | — | Worker | Enum exists |
| BE-041 | Activities | Activity payments / ticketing | `NOT_STARTED` | P2 | MDWQ-0707 | Billing | DEC-010 | None | — |
| BE-042 | Activities | Activity Message Group | `NOT_STARTED` | P2 | MDWQ-0711 ACT-CHAT | Product | — | Decision | Use community chat until then |
| BE-043 | Activities | Saved-count vs visible list | `PARTIAL` | P2 | MDWQ-0718 | Count query | — | Settings count fix | Count matches 025C filter |
| BE-044 | Activities | Declined reapply policy change | Implemented deny `409` | P2 | MDWQ-0719 | Product may relax | ACT-APPROVAL | Decision only | Keep 409 until changed |
| BE-045 | Meetup | Duration/end time | OPEN | P2 | MDWQ-0725 note | Validation | D-28 | Decision | Start + TZ + note only |
| BE-046 | Profile | Screen 10 enrichments | `NOT_STARTED` | P2 | MDWQ-0726 | Public APIs | COPY-TRUST | Later | — |
| BE-047 | Store | Product reviews | `DEFERRED` | P2 | MDWQ-0808 | MKT-04 | DEC-014 | None | — |
| BE-048 | Store | Club cart discounts | `DEFERRED` | P0 if Club sold | MDWQ-0809 | D-08 + MKT-03 | DEC-010 | None | `NOT_CONFIGURED` |
| BE-049 | Jobs | Withdrawal / status transitions | `PARTIAL` | P1 | MDWQ-0905 | JOB-02 | BE-022 | 029G | Enum only today |
| BE-050 | Jobs | Tab badge counts | `NOT_STARTED` | P2 | MDWQ-0906 | — | — | Optional | — |
| BE-051 | Groups | My Groups tab aggregate counts | `PARTIAL` | P2 | MDWQ-0912 | 0910 source | DEC-032 | Optional | Client-side today |
| BE-052 | Groups | Details tab badge counts | `NOT_STARTED` | P2 | MDWQ-0913 | — | DEC-031 | Optional | — |
| BE-053 | Groups | Manage “+N this wk” | `NOT_STARTED` | P2 | MDWQ-0915 | COPY-TRUST | DEC-028 | None | No fabricated deltas |
| BE-054 | Membership | Post-purchase manage APIs | `NOT_STARTED` | P1 | MDWQ-1005 | Billing | DEC-010 | After 026B | — |
| BE-055 | Settings | Support/legal URLs | `NOT_STARTED` | P2 | MDWQ-1104 | Content owner | SET-05 | Copy | — |
| BE-056 | Settings | Blocked-users management expansion | `PARTIAL` | P2 | MDWQ-1105 | Product | Task 009 blocks exist | Decision | — |
| BE-057 | Tooling | LF / format-drift normalization | `PARTIAL` | P2 | MDWQ-0105 | Owner mechanical commit | — | Format commit | CI LF |
| BE-058 | KYC | Task 002B.3B provider-neutral foundation | `NOT_STARTED` | P0 if authorized | MDWQ-0307 | Explicit owner start | — | Do not start | — |
| BE-059 | Auth | Phone verify write path | `NOT_STARTED` | P1 | SET-04 | SMS | DEC-012 | None | Read-only phone |
| BE-060 | Notifications | Scheduled activity reminders | `NOT_STARTED` | P2 | Task 013 deferral | Product | BE-013 | Decision | — |

---

## Implemented-and-closed (do not re-open)

These are **not** backlog items. Listed so later tasks do not re-audit them.

| Area | Closed within approved scope | Evidence |
|---|---|---|
| Email/password auth + Task 022 Home gate | Yes (email verify optional after 031B.2) | ADR-005 amendment; 022D E2E |
| Mock KYC sessions | Yes (non-prod) | Task 021 |
| Manual KYC + Cloudinary sandbox | Yes (sandbox) | 031J-2A |
| Identity review queue/detail/approve/reject/hold/notes/export/batch | Code complete; sandbox used | 022B, 031E–H |
| Users list/detail/suspend/restore + socket eviction | Sandbox verified | 032E |
| Activities list/summary/detail/CSV | Sandbox verified | 033C |
| Activity admin cancel writers + 033D schema on test | Code + migration; E2E open (INT-004) | 033D/E |
| Activities host CRUD, RSVP, waitlist, hybrid join, roster | Member APIs | Tasks 010, 027 |
| Groups core + jobs apply-in-platform | Approved 029 scope | 029H |
| Store cart/pricing/fulfillment **non-payment** | Yes | 024A–D |
| Membership read-only `flow` | Yes | 026A |
| Messaging summary + sockets + device tokens | Focused Neon | Task 023 |
| Admin dashboard read-only aggregations | Sandbox verified; premium/revenue/retention/groups-reports-transactions feeds remain unavailable | 035A |

---

## ID index

| Prefix | Count in this file |
|---|---|
| BE-001–025 + BE-061–066 Section A | 31 |
| DEC-001–035 Section B | 35 |
| INT-001–012 Section C | 12 |
| BE-026–060 Section D | 35 |
| **Open backend rows** | **113** |

MDWQ aliases remain valid. New work should add a BE/DEC/INT row here rather than silently extending only MDWQ.
