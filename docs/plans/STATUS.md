# StrangeUp Engineering Status (as of 2026-10-31, Task 033E)

**Task 033E (Apply ActivityModerationDecision migration):** **COMPLETE (schema only)** — Owner-authorized `scripts/migrate-integration-only.ts` applied **only** `20261031140000_task033d_activity_moderation_decision` to Neon **`strangeup_test`**. Live `current_database() = 'strangeup_test'` was true; catalog is now **28/28**. Read-back confirmed enum `ActivityModerationAction` (`CANCEL`), table `ActivityModerationDecision` (0 rows), unique idempotency index, activity/actor indexes, and FKs to `Activity` (CASCADE) / `User` (RESTRICT). **`strangeup_dev` remains 23 migrations and does not have this table. No production URL in this workspace. No seed, cleanup, cancel, or E2E writes.** **STOP after 033E.**

**Task 033C (Activities synthetic seed + real Admin UI verification):** **COMPLETE (sandbox-verified)** — Repeatable seed `scripts/seed-admin-activities-sandbox.ts` wrote **22 users / 36 activities / 119 participations** to Neon **`strangeup_test` only** after live `current_database()` checks. Authorized `IDENTITY_REVIEWER` API smoke **26/26**. Admin Vite `:5174` confirmed six metric cards, populated list/filters/pagination/CSV, and Details (hero, overview, host, roster, honest unavailable modules). One in-scope UI fix: Activities table wrapper `overflow-x-auto` so Status/View Details are reachable. Cleanup is dry-run by default and limited to task-owned `TASK033C_SANDBOX_SEED` rows. **No writes to `strangeup_dev` or production. No migrations. Veriff/Manual KYC/Cloudinary unchanged.** **STOP after 033C.**

**Task 032E (Users Management final sandbox E2E + socket revocation):** **COMPLETE (sandbox-verified)** — `applyAccountRestrictionSideEffects` is invoked after a committed `SUSPEND` only (not before commit; failures logged, decision not rolled back). Isolated E2E on Neon **`strangeup_test` 27/27** via API `:3010` / Admin BFF `:3011` / Vite `:5174`: authorized staff login, Users List/Details, suspend/restore, audit, idempotency, authorization, session/device revocation, Home denial, and live socket eviction. Temporary `SUPER_ADMIN` on an existing synthetic `IDENTITY_REVIEWER` was granted and **revoked**. Target returned to `ACTIVE`. **Veriff and Manual KYC unchanged.** **No migration applied to `strangeup_dev` or production.** **STOP:** Users Management sign-off is recommended for the isolated sandbox; production/dev rollout still depends on owner applying `20261031120000_task032c_account_moderation_decision` and controlled `SUPER_ADMIN` provisioning.

**032A–032D recap:** List + Details + Suspend/Restore writers + 032C migration on `strangeup_test` only.

---

# StrangeUp Engineering Status (as of 2026-10-30, Task 031I-M1)

**Task 031I-M1 (Manual KYC + Cloudinary evidence):** **COMPLETE (backend code + unit tests)** — explicit `KYC_IDENTITY_AUTHORITY` paths; Cloudinary authenticated upload/download/destroy adapter; manual session + evidence APIs; staff proxy delivery + manual identity decision (distinct from Veriff webhooks). **Veriff files untouched** (031I-1 adapter remains gated). **MIGRATION PENDING** `20261030180000_task031im1_manual_kyc_cloudinary_evidence`. Production fail-closed for manual/Cloudinary. **STOP:** owner applies migration, Cloudinary creds on non-prod, `KYC_IDENTITY_AUTHORITY=manual` + `KYC_MANUAL_REVIEW_ENABLED=true` smoke; no Flutter/Admin edits in this checkpoint.

---

# StrangeUp Engineering Status (as of 2026-10-30, Task 031I-1)

**Task 031I-1 (Veriff sandbox backend integration):** **COMPLETE (code + mocked tests)** — Veriff `POST /v1/sessions` adapter, decision webhook HMAC + `x-auth-client` validation, stale/revoked identity guards, Flutter handoff §12. **Not live-tested** against Veriff sandbox until owner supplies credentials and approves `VERIFF_LIVE_CALLS_ENABLED=true` on a non-production API. Production remains fail-closed (mock/Veriff live forbidden). **STOP:** owner sandbox credentials + portal webhook URL + optional live sandbox smoke.

---

# StrangeUp Engineering Status (as of 2026-10-30, Task 031H-2)

**Task 031H-2 (Verification batch approve/reject):** **COMPLETE (code)** — `POST /v1/admin/identity-reviews/batch-decide` (max 10, non-atomic, per-item idempotency keys derived from `batchRequestId` + payload fingerprint); Admin BFF + queue batch selection/confirm/results UI. **Limitation:** no single DB row binds an entire batch payload — fingerprint is embedded in per-applicant keys only. Integration: `admin-identity-review-031h2.integration.test.ts` (skipped unless `RUN_INTEGRATION=1`).

**Task 031H-1 (Verification queue CSV export):** **COMPLETE (code)** — `GET /v1/admin/identity-reviews/export` with list-equivalent filters, 1k row cap + truncation headers, CSV injection defenses, structured access log via `pino` (no durable DB audit row). Admin BFF + queue **Export CSV** UI.

**Task 031G (Paginated admin decision audit history):** **COMPLETE (code)** — `GET /v1/admin/identity-reviews/:reviewId/decisions` (cursor pagination); Admin BFF + audit panel use paginated decisions with dual load-more streams. Integration: `admin-identity-review-031g.integration.test.ts` (skipped unless `RUN_INTEGRATION=1`).

**Task 031F-1 (Internal review hold + staff notes — backend code):** **MIGRATION PENDING** — schema + migration SQL `20261030150000_task031f1_internal_review_hold_notes`; routes hold/return/notes; summary split + list `posture`. **Not production-ready** until owner applies migration to dev/test/prod. Integration tests prepared (`admin-identity-review-031f1.integration.test.ts`, skipped). **STOP:** owner applies migration, then run integration suite + 031F-2 Admin UI.

---

# StrangeUp Engineering Status (as of 2026-10-30, Task 031B.2)

**Task 031B.2 (Mandatory email verification gate removal):** **COMPLETE** — backend policy only. Register → `ACTIVE` without auto verify email; `hasHomeAccess` and admin approve no longer require `emailVerifiedAt`; optional `POST /v1/auth/email-verification/*` retained. ADR-005 amendment `docs/decisions/ADR-005-amendment-2026-10-30-email-optional-onboarding.md`. Docs/handoff updated. **STOP:** await owner before Admin Panel BFF/UI or KYC provider activation.

---

# StrangeUp Engineering Status (as of 2026-10-29, Task 030 complete)

**Task 030 (Backend completion & Admin Panel readiness):** **COMPLETE (audit only)** — no code, migrations, or Admin UI. Deliverables: `TASK_030_BACKEND_COMPLETION_AUDIT_REPORT.md`, `ADMIN_PANEL_API_READINESS_MATRIX.md`, `BACKEND_REMAINING_WORK_CHECKLIST.md` (includes proposed **Task 031** Admin Panel phases). **Finding:** Flutter/staging APIs are broadly **IMPLEMENTED** within deferred flags; **production release not ready** (MDWQ-0099–0103, KYC/email/media). Task **022B** identity-review REST is **ready for a separate React Admin Panel**; gaps: global user search, suspend REST, request-more-info, full audit pagination. **`strangeup_dev`** missing migrations **028C+028G** (**MDWQ-0310**); **`strangeup_test`** current (**22/22**). **STOP:** await owner review before **Task 031** or backend P0/P1 implementation.

---

# StrangeUp Engineering Status (as of 2026-10-29, Task 029H complete)

**Task 029 (Groups & Jobs):** Backend **COMPLETE WITHIN APPROVED SCOPE** — see `TASK_029H_FINAL_VERIFICATION_REPORT.md` and `FIGMA_GROUPS_JOBS_PARITY_TASK029H_FINAL.md`. **Not** full Figma parity, Jobs publish/employer delivery, or production readiness. Phases **029E** and **029G** **SKIPPED** for this closure (MDWQ rows **open**).

---

## Task 029H (Phase H — Final verification & closure)

- **Scope:** Consolidated parity matrix; bounded Neon regression (groups 029B–D, jobs 029F); doc reconciliation.
- **Tests:** typecheck/lint/build pass; unit **285/285**; groups integration **20/20**; jobs integration **8/8** on `strangeup_test`.
- **Harness:** T029F-P01 unique search tokens (shared Neon isolation — not an app defect).
- **OPEN:** **MDWQ-0910**, **MDWQ-0911**; jobs **0901**, **0902**, **0903**, **0905**, **0906**; group **0505**, **0912–0915**.
- **STOP:** Task 029 closed; Task 030 audit complete (see header).

---

## Task 029F (Phase F — Jobs discovery & saved jobs)

- **Scope:** Screen 23 read/save parity vs Task 014; no publish, employer delivery, or 029G application lifecycle changes.
- **Fix:** `GET /v1/jobs` — combine `q` and `cursor` with **AND** (`job-query.ts`); previously cursor overwrote search.
- **Tests:** typecheck/lint/build pass; unit **285/285**; jobs integration **8/8** on `strangeup_test` (T029F-P01–P04 + Task 014 regressions).
- **Docs:** `TASK_029F_JOBS_DISCOVERY_SAVED_REPORT.md`, `FIGMA_GROUPS_JOBS_PARITY_TASK029F.md`.
- **029E:** **SKIPPED/DEFERRED** (interactive group features — owner scope).
- **OPEN:** **MDWQ-0910**, **MDWQ-0911**; jobs **MDWQ-0901**, **0902**, **0903**, **0905**, **0906**.
- **STOP:** **029G not started.**

---

## Task 029D (Phase D — Membership lifecycle & authorization)

- **Scope:** Join/approve/decline/leave/roles/capacity/archived guards; Task 022/023; 029B inventory accuracy.
- **Fixes:** Block decline/remove/role/transfer/re-archive on **ARCHIVED** groups; `onUserLeftGroup` after moderator **remove**.
- **Tests:** unit **283/283**; groups integration **20/20** on `strangeup_test` (T029D-P01–P04 + 029B/C regressions).
- **Docs:** `TASK_029D_GROUPS_MEMBERSHIP_LIFECYCLE_REPORT.md`, `FIGMA_GROUPS_JOBS_PARITY_TASK029D.md`.
- **OPEN:** MDWQ-0910, MDWQ-0911, MDWQ-0505 (invitations).
- **STOP:** **029E SKIPPED/DEFERRED** (owner scope); **029F** closed this slice.

---

## Task 029C (Phase C — Create & manage group)

- **Scope:** Audit Screen 1 & 2 PDFs vs Task 012 create/manage; preserve 029B, flags, billing deferral.
- **Fix:** Block `PATCH` and cover mutations on **ARCHIVED** groups (`assertGroupActiveForMutation`).
- **Tests:** unit **283/283**; groups integration **16/16** on `strangeup_test` (T029C-P01–P04).
- **Parity:** `FIGMA_GROUPS_JOBS_PARITY_TASK029C.md`, `TASK_029C_GROUPS_CREATE_MANAGE_REPORT.md`.
- **OPEN:** MDWQ-0910, MDWQ-0911; unsupported Figma stats/categories documented.
- **STOP:** **029D not started.**

---

## Task 029B (Phase B — Groups read inventory)

- **Scope:** Discovery, detail, `GET /v1/me/groups` inventory views; preserve Task 012 policies, 022 gate, interactive flag off.
- **Change:** Added `view` (`all` \| `joined` \| `managed` \| `pending`) and `q` on **`GET /v1/me/groups`** (same route; managed tab in one paginated query).
- **Figma:** My Groups screen **UNVERIFIED** — `Html → Body.pdf` still duplicate (**MDWQ-0910 OPEN**); Group Details authority **MDWQ-0911 OPEN**.
- **Tests:** typecheck/lint/build pass; unit **283/283**; groups integration **12/12** on `strangeup_test` (T029B-P01–P03).
- **Report:** `TASK_029B_GROUPS_READ_INVENTORY_REPORT.md`.
- **STOP:** **029C not started.**

---

## Task 029A (Phase A — Groups & Jobs read-only source audit)

- **Deliverables:** `TASK_029A_GROUPS_JOBS_SOURCE_AUDIT_REPORT.md`, `FIGMA_GROUPS_JOBS_PARITY_TASK029A.md`; MDWQ **0910–0915**, **0905–0906**.

---

# StrangeUp Engineering Status (as of 2026-10-29, Task 027I complete)

**Task 027 (After membership activities):** Backend **COMPLETE WITHIN APPROVED SCOPE** — see `TASK_027I_FINAL_VERIFICATION_REPORT.md` and `FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027I_FINAL.md`. Phases **027G** (chat/follow/cutoff/catalog) and **027H** (ACT-NOTIFY) **SKIPPED** — MDWQ rows retained. **Not** full Figma parity or production readiness.

## Task 027I (Phase I — Final verification & closure)

- **Parity:** `FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027I_FINAL.md` (Screen 12, My Activities, Create, Join Requests).
- **Tests:** typecheck/lint/build pass; unit **279/279**; bounded Neon **25/25** (027B–F + T025C-P01/P02 on `strangeup_test`).
- **Harness:** T027F-04 username collision fix (integration isolation only).
- **Queue:** MDWQ-0718 (saved count vs visible list), MDWQ-0719 (declined reapply policy).
- **STOP:** Task 027 closed within approved scope; no 027G/H implementation.

---

# StrangeUp Engineering Status (as of 2026-10-29, Task 028H complete)

**Task 028 (Discover & personal meetup):** Backend **READY_FOR_OWNER_REVIEW** — see `TASK_028H_FINAL_VERIFICATION_REPORT.md`. `capabilities.meetupInvites` remains **DEFERRED** until owner authorizes LIVE.

## Task 028H (Phase H — Final verification)

- **Parity:** `FIGMA_DISCOVER_MEETUP_PARITY_TASK028H_FINAL.md`
- **Tests:** `meetup-invite-028h-final.integration.test.ts` (lifecycle, security, rollback, regressions)
- **Owner:** `TASK_028H_OWNER_SIGNOFF_CHECKLIST.md`
- **Migrations:** strangeup_test current; strangeup_dev pending 028C+028G (report only)
- **STOP:** Task 028 backend complete; no further flow started.

---

## Task 028G (Phase G — Meetup notifications)

- **Implemented:** Four `UserNotificationType` values; `meetupInvitesEnabled` preference; emitter on create + successful accept/decline/withdraw (transactional).
- **Migration:** `20261029180000_task028g_meetup_notifications` (applied **strangeup_test**).
- **Tests:** `meetup-invite-notifications.test.ts`; `meetup-invite-028g-notifications.integration.test.ts` (**9/9** Neon).
- **Report:** `TASK_028G_PERSONAL_MEETUP_NOTIFICATIONS_REPORT.md`.
- **Capability:** `settings.capabilities.meetupInvites` still **DEFERRED**.
- **STOP:** 028H not started; 028F reschedule deferred.

---

## Task 028E (Phase E — Accept / decline / withdraw)

- **APIs:** `POST /v1/meetup-invites/:inviteId/accept|decline|withdraw` (Task 022 + participant eligibility; recipient KYC on accept).
- **Integrity:** Lazy expiry before transition; row `FOR UPDATE` + conditional `PENDING` update; idempotent terminal **200** / conflict **409**.
- **Tests:** `tests/integration/meetup-invite-028e.integration.test.ts` (Neon when `RUN_INTEGRATION=1`).
- **Docs:** `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md` §13A, `openapi/meetup-invites.yaml`, `TASK_028E_PERSONAL_MEETUP_MUTATIONS_REPORT.md`.
- **Capability:** `settings.capabilities.meetupInvites` remains **DEFERRED** (owner sign-off).
- **STOP:** 028F (reschedule) not started.

---

## Task 028D (Phase D — Meetup invite REST: create + inbox + detail)

- **APIs:** `POST/GET /v1/meetup-invites`, `GET /v1/meetup-invites/:inviteId` (Task 022 gated).
- **Fix:** Social target load includes activation fields for discoverability (025B-aligned).
- **Tests:** integration **5/5** on `strangeup_test`; unit suite **276** pass.
- **Docs:** `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md` §13A, `openapi/meetup-invites.yaml`.
- **STOP:** 028E completed in separate phase header above.

---

# StrangeUp Engineering Status (as of 2026-10-29, Task 028C complete)

## Task 028C (Phase C — Personal meetup Prisma + policy foundation)

- **Decision:** D-28 **Accepted (foundation scope)** — owner rules 2026-10-29.
- **Schema:** `PersonalMeetupInvitation`, enums, partial unique pending pair, `ON DELETE RESTRICT`.
- **Code:** `src/modules/meetup-invites/*` (state, validation, venue redaction, policy).
- **Migration:** `20261029170000_task028c_personal_meetup_invitation` applied to **strangeup_test** only (this phase).
- **Tests:** unit **276** pass; integration schema **2/2** on Neon test catalog.
- **STOP:** 028D (HTTP) not started.

---

# StrangeUp Engineering Status (as of 2026-10-29, Task 028B complete)

## Task 028B (Phase B — Personal meetup policy + API contract design)

- **Delivered:** D-28 **PROPOSAL** (not owner-approved); state machine; Prisma/REST/DTO draft; owner checklist; Figma parity contract notes; MDWQ-0728.
- **Gate:** Owner completes `TASK_028B_OWNER_DECISION_CHECKLIST.md` before **028C** (schema only).
- **STOP:** 028C not started — no Prisma/routes/tests.

---

# StrangeUp Engineering Status (as of 2026-10-29, Task 028A complete)

## Task 028A (Phase A — Discover & direct meetup read-only audit)

- **Delivered:** Figma PDF hash verification; source audit of discovery, social, notifications, Prisma, routes; parity matrix; owner decision table; MDWQ-0720–0727.
- **Finding:** Personal meetup invitations **not implemented** (no schema/routes); **separate from** Task 027E Activity host approval.
- **Docs:** `TASK_028A_DISCOVER_MEETUP_AUDIT_REPORT.md`, `FIGMA_DISCOVER_MEETUP_PARITY_TASK028A.md`, `MASTER_DEFERRED_WORK_QUEUE.md` § Task 028.
- **STOP:** 028B not started — owner `MEET-*` decisions required before contract design.

---

# StrangeUp Engineering Status (as of 2026-10-29, Task 027F complete)

## Task 027F (Phase F — Attendee roster / ACT-ROSTER)

- **Delivered:** `GET /v1/activities/:id/participants` — CONFIRMED-only, host or CONFIRMED participant, D-03 previews, preview cap 5.
- **Verified:** see `TASK_027F_ATTENDEE_ROSTER_REPORT.md`.
- **STOP (historical):** 027G+ deferred — see Task 027I closure header above.

## Task 027E (Phase E — Hybrid join mode / host approval)

- **Decision:** D-09 — `AUTO` \| `HOST_APPROVAL`; existing rows default `AUTO`.
- **APIs:** join-requests list/approve/decline; RSVP PENDING path; inventory `view=pending`; `hostParticipationSummary`.
- **Verified:** unit **255**; bounded Neon integration **10/10** (`activity-join-approval-027e` + security audit suite); see `TASK_027E_SECURITY_VERIFICATION_AUDIT.md`.

## Task 027D (Phase D — Create/manage audit & saved-activities privacy)

- **AUDIT:** Host create/edit/publish/cancel, capacity/schedule locks, cover boundaries — **no host-service defects**; regression tests added.
- **FIX (MDWQ-0715):** Saved activities list/save apply Task 025C/027C host discoverability; rows preserved in DB.
- **TESTS:** `saved-activity-visibility.test.ts`; `activity-manage-027d`, `saved-activities-privacy-027d` Neon (**6/6** with 027C regression).
- **STOP:** 027E complete; 027F not started.

---

# StrangeUp Engineering Status (as of 2026-10-29, Task 027C complete)

## Task 027C (Phase C — Activity privacy & data-integrity hardening)

- **FIX:** Align non-host `GET …/meeting` and new `POST …/rsvp` with 025C host discoverability (detail/cover already 404).
- **ADD:** `activity-public-visibility.ts` shared guard; participation history preserved on denial.
- **TESTS:** `activity-public-visibility.test.ts`; `activity-privacy-027c.integration.test.ts` (**3/3** Neon); 027B inventory regression **2/2**.
- **QUEUE:** MDWQ-**0715** (saved activities host filter — audit follow-up, not implemented).
- **STOP:** 027D **not started**.

---

# StrangeUp Engineering Status (as of 2026-10-29, Task 027B complete)

## Task 027B (Phase B — My Activities read-model)

- **NEW API:** `GET /v1/me/activity-inventory?view=upcoming|hosting|joined|waitlisted|past` (+ optional `includeCounts`); public cards only.
- **EXTENDED:** `GET /v1/me/activities?when=…`, `GET /v1/me/activity-rsvps?when=…&participation=…`.
- **PRESERVED:** Instant RSVP/FIFO (AUTO default); Task 022 gate; D-08 billing deferred. *(027E added optional HOST_APPROVAL — see D-09.)*
- **DOCS/OPENAPI:** `openapi/activities.yaml` 0.2.0, handoff §10, `TASK_027B_ACTIVITIES_POST_MEMBERSHIP_REPORT.md`.
- **TESTS:** `activity-my-inventory.policy.test.ts`; `activity-inventory-027b.integration.test.ts` (**2/2** Neon bounded).
- **STOP:** 027C **not started**.

---

# StrangeUp Engineering Status (as of 2026-10-29, Task 027A complete)

## Task 027A (Phase A — After Membership Activities source verification)

- **SCOPE:** Documentation only — verified `design-reference/task027-activities-post-membership/` (5 PDFs + manifest); corrected **`Html → Body-1.pdf` = Join Requests** (not Body-4 / Settings).
- **FINDINGS:** Instant RSVP + FIFO waitlist preserved; host approval queue **MISSING** (ACT-APPROVAL); My Activities **PARTIAL** (dual API merge); Join Requests shows **6/10 filled** vs **Approved (8)** — documented, not interpreted as rules.
- **DOCS:** `FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027A.md`, `TASK_027A_ACTIVITIES_POST_MEMBERSHIP_REPORT.md`, `MASTER_DEFERRED_WORK_QUEUE.md` (MDWQ-0710–0713).
- **PRESERVED:** Tasks 010, 022, 025C, 026A — no code/migration/test changes.
- **STOP:** 027B **not started** (owner gate for optional read-model aggregation).

---

# StrangeUp Engineering Status (as of 2026-10-28, Task 026A complete)

## Task 026A (Phase A — Membership flow read-only contract)

- **OWNER:** Defer **all** payment/subscription billing until further notice (`docs/decisions/D-08-owner-defer-billing-2026-10-28.md`).
- **API:** `GET /v1/membership/plans`, `GET /v1/me/membership` — added versioned **`flow`** contract; benefit statuses **`AVAILABLE` / `NOT_CONFIGURED` / `DEFERRED` / `NOT_IMPLEMENTED`**; Club checkout/restore **DEFERRED**; **`BASIC`** effective tier only.
- **PRESERVED:** Task 017 registry, Task 022 gate, no ledger/migrations, store checkout **UNAVAILABLE**, ADR-003 commerce separation.
- **DOCS:** `FIGMA_MEMBERSHIP_PARITY_TASK026A.md`, `TASK_026A_MEMBERSHIP_FLOW_REPORT.md`, handoff §9/§19, `openapi/membership.yaml` 0.2.0.
- **TESTS:** `membership-flow-contract.test.ts`; updated unit + `membership.integration.test.ts` (Neon gate).
- **STOP:** 026B **not started**.

---

# StrangeUp Engineering Status (as of 2026-10-28, Task 024D complete)

## Task 024D (Phase D — Fulfillment & order architecture foundations)

- **DOMAIN:** `src/modules/physical-commerce/*` — ADR-003 separation from membership billing; no Prisma order models.
- **API:** `GET /v1/store/fulfillment-policy`; cart `fulfillment` + `orderReadiness` (blocks `INSUFFICIENT_STOCK` for future orders).
- **VALIDATION:** Future idempotency / address / fulfillment Zod schemas (no write routes).
- **PRESERVED:** 024A–024C cart/pricing, checkout UNAVAILABLE, 024B admin, Task 022 gate.
- **DOCS:** `STORE_FULFILLMENT_ORDER_ARCHITECTURE_TASK024D.md`, handoff §17.3.
- **TESTS:** `physical-commerce-*` unit; `store-fulfillment-024d.integration.test.ts`.
- **STOP:** 024E not started (payments/checkout).

---

# StrangeUp Engineering Status (as of 2026-10-28, Task 024C complete)

## Task 024C (Phase C — Pricing & Club benefits contract)

- **MODEL:** `LIST_PRICE_PLUS_SINGLE_CART_DISCOUNT` — list `priceCents` authoritative; anti-double-discount policy documented; no member line prices + cart discount stacking.
- **API:** `GET /v1/store/pricing-policy`; product `pricingHint` / `variants[].pricing`; cart `pricingQuote` — all membership/shipping/tax **`NOT_CONFIGURED`**, `totalDueCents=null`, checkout **UNAVAILABLE**.
- **DOCS:** `docs/product/STORE_PRICING_CLUB_CONTRACT_TASK024C.md`, handoff §17.2, `CURRENT_APIS.md`, `openapi/store.yaml`.
- **TESTS:** `store-pricing.test.ts`, `store-pricing-024c.integration.test.ts`.
- **NO SCHEMA MIGRATION** — entitlements remain BASIC-only (Task 017).
- **STOP:** 024D not started (fulfillment/orders architecture, still no payments).

---

# StrangeUp Engineering Status (as of 2026-10-28, Task 024B complete)

## Task 024B (Phase B — Trusted catalog ops & store media)

- **IMPLEMENTED:** `/v1/admin/store-catalog/*` staff APIs (product/variant CRUD, publish/archive, stock concurrency, image ingest); role **`STORE_CATALOG_MANAGER`** (migration `20261028180000_store_catalog_manager_role`); **`STORE_CATALOG_MANAGEMENT_ENABLED`** default off + production fail-closed.
- **MEDIA:** S3 namespace `store-product` + local `STORE_UPLOAD_DIR`; legacy local read fallback on S3 backend; buyer image route unchanged.
- **PRESERVED:** Public store/cart/favorites (024A), Task 022 gate, checkout `UNAVAILABLE`, no badges/reviews/seller onboarding.
- **DOCS:** `STORE_CATALOG_MANAGEMENT_TASK024B.md`, `PLATFORM_STAFF_PROVISIONING.md`, `CURRENT_APIS.md`, `openapi/admin.yaml`, handoff §17.1.
- **TESTS:** `store-catalog-policy.test.ts`, `store-catalog-admin.validation.test.ts`, `store-catalog-024b.integration.test.ts`.
- **NOT RUN:** Full Neon regression; no live S3 writes in CI (local media backend in integration).
- **STOP:** 024C+ not started.

---

# StrangeUp Engineering Status (as of 2026-10-28, Task 024A complete)

## Task 024A (Phase A — Marketplace catalog & cart integrity)

- **FIX:** Cart read path no longer treats insufficient-stock lines as fully payable in `subtotalCents`; added `linesSubtotalCents`, per-line `eligibleLineSubtotalCents` / `maxPurchasableQuantity` / `availabilityReason`, and cart `summary` flags.
- **PRESERVED:** Server catalog prices, published-only writes, Task 022 home gate, cart isolation, mixed-currency rejection, `checkout.status=UNAVAILABLE`, no orders/reservations/payments/Club discounts.
- **DOCS:** `docs/product/FIGMA_MARKETPLACE_PARITY_TASK024A.md`, `FLUTTER_DEVELOPER_HANDOFF.md` §17, `CURRENT_APIS.md`, `openapi/store.yaml`.
- **TESTS:** `tests/store-cart.test.ts` (unit); `tests/integration/store-cart-024a.integration.test.ts` (Neon gate).
- **NOT RUN:** Full Neon regression (release gate only).
- **STOP:** 024B+ not started (operator catalog ingest, Club pricing, fulfillment, payments).

---

# StrangeUp Engineering Status (as of 2026-10-28, Task 023E complete)

## Task 023E (Phase E — Header Flow final parity audit)

- **AUDIT:** `docs/product/FIGMA_HEADER_FLOW_PARITY_TASK023.md` — Screens 14/16/17, notifications PDF, socket + push matrix (MATCHED/PARTIAL/MISSING/DEFERRED).
- **FIXES:** Push stale-notification backlog guard (`PUSH_MAX_NOTIFICATION_AGE_SECONDS`); `applyAccountRestrictionSideEffects` export for future admin suspend writer.
- **TESTS:** `header-flow-023e.integration.test.ts`, `notification-preference-push.integration.test.ts`, extended push-outbox (stale + dedupe).
- **NOT RUN:** Full Neon regression (release gate only).
- **STOP:** Task 023 complete; no further Header Flow phases in plan.

---

# StrangeUp Engineering Status (as of 2026-10-28, Task 023D complete)

## Task 023D (Phase D — FCM infrastructure + socket account hardening; live send off)

- **Socket hardening:** Periodic account/session eligibility recheck disconnects suspended users; server-side typing TTL stop; summary emit skips ineligible recipients; lifecycle hook `onUserAccountRestricted` for proactive disconnect.
- **IMPLEMENTED:** `firebase-admin` sender abstraction (mock/disabled/firebase); `PushNotificationOutbox` migration + worker (atomic claim, backoff, dedupe via unique notification id, stale lock recovery); enqueue from `NotificationEmitter`; `PUSH_ENABLED=false` default; production still fail-closed for live push.
- **DOCS:** handoff §14.7, `docs/operations/PUSH_DELIVERY_TASK023D.md`, `.env.example`.
- **TESTS:** `push-payload.test.ts`, `messaging-realtime.typing-expiry.test.ts`, `push-outbox.integration.test.ts`, socket suspend/summary tests in `messaging-socket.integration.test.ts`.
- **DEFERRED (023E):** Header Flow final parity, group notification product decisions, full Neon regression, production FCM authorization, Redis Socket.IO cluster adapter.

---

# StrangeUp Engineering Status (as of 2026-10-28, Task 023C complete)

## Task 023C (Phase C — device tokens & preferences; FCM off)

- **023B hardening:** User-targeted socket delivery with live recipient ACL; proactive room eviction on block/group leave; session logout disconnect; startup fails if `SOCKET_IO_REDIS_ADAPTER_ENABLED=true` without adapter; passive leak integration tests.
- **IMPLEMENTED:** `UserDeviceToken` + `UserNotificationPreference` migration; `POST/GET/DELETE /v1/me/device-tokens`; `GET/PATCH /v1/me/notification-preferences`; session logout revokes bound tokens; `PUSH_ENABLED=false` default + production fail-closed.
- **DOCS:** `openapi/push-devices.yaml`, handoff §14.6, `CURRENT_APIS.md`.
- **TESTS:** `push-devices.integration.test.ts`, extended `messaging-socket.integration.test.ts`, `messaging-realtime.redis-startup.test.ts`.

---

# StrangeUp Engineering Status (as of 2026-10-28, Task 023B complete)

## Task 023B (Phase B — Socket.IO messaging realtime)

- **IMPLEMENTED:** Socket.IO on shared HTTP server; JWT + session + Task 022 gate; DM/group subscribe ACL; REST-triggered broadcasts (`dm_message`, `group_message`, read + `messaging:summary`); ephemeral typing; idempotent REST does not re-broadcast; session revalidation on protected client events.
- **CONFIG:** `SOCKET_IO_ENABLED`, `SOCKET_IO_PATH`, typing intervals; `SOCKET_IO_REDIS_ADAPTER_ENABLED=false` (multi-instance adapter not wired — do not reuse rate-limit Redis).
- **DOCS:** `FLUTTER_DEVELOPER_HANDOFF.md` §14.5, `openapi/messaging-realtime.yaml`.
- **TESTS:** `tests/integration/messaging-socket.integration.test.ts`, `tests/messaging-realtime.typing.test.ts`.
- **DEFERRED (023C+):** FCM/device tokens, push delivery, Redis cluster adapter verification, full Header Flow E2E.

---

# StrangeUp Engineering Status (as of 2026-10-28, Task 023A complete)

## Task 023A (Phase A — REST messaging summary)

- **IMPLEMENTED:** `GET /v1/me/messaging/summary` — `directUnread`, `groupUnread`, `messageRequestsPending`, `totalUnreadMessages` / `displayBadgeCount`, thread-level breakdown fields; Task 022 home gate; block/privacy aligned with existing DM/group/request list semantics.
- **DOCS:** `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md` §14, `openapi/social.yaml`, `docs/product/FIGMA_HEADER_FLOW_PARITY_TASK023A.md`.
- **TESTS:** `tests/integration/messaging-summary.integration.test.ts` (Neon gate); unit/typecheck/lint/build in phase report.
- **DEFERRED (023B+):** Socket.IO, FCM, typing, presence, chat media, owner group invitations, full Header Flow E2E.

---

# StrangeUp Engineering Status (as of 2026-10-28, Task 022D complete)

## Task 022A (accepted)

- Admin review lifecycle schema, `GET /v1/me/onboarding/status`, tightened Home gate (provider KYC + admin approval), IDV without circular gate, provider APPROVED → admin `PENDING`. ADR-005.

## Task 022B (accepted — local, not committed)

- `PlatformStaffGrant` + `IDENTITY_REVIEWER`; admin identity review list/detail/approve/reject; audit + idempotency; onboarding `ADMIN_REJECTED`; ops doc + `openapi/admin.yaml`.

## Task 022C (Phase C — local, not committed)

- **IMPLEMENTED:** Central `assertMainAppHomeAccess` (DB reload per request); router-level `authenticate` + `requireHomeAccess` on main-app mounts in `app.ts`; `/v1/me` split — onboarding-safe routes before gate, product routes after `authenticate` + gate; error codes `ONBOARDING_REQUIRED` / `ACCOUNT_NOT_ACTIVATED` with `nextAction`, `onboardingPhase`, `homeAccessAllowed`.
- **Ungated:** `/v1/auth/*`, `/v1/consents/*`, `/v1/webhooks/*`, `/health/*`, `/v1/admin/*` (staff only), `/v1/interests` catalog (auth + account access only).
- **Tests:** Shared `tests/helpers/integration-user.ts` + `seedMainAppActivatedUser`; `tests/integration/access-enforcement.integration.test.ts`; legacy integration fixtures updated.
- **VERIFIED (Neon `strangeup_test`):** unit **203** passed; integration **117 passed**, 1 skipped (118 total); prisma validate/generate, typecheck, lint, build.
## Task 022D (Phase D — local, not committed)

- **DONE:** Figma auth ZIP parity matrix (`docs/product/FIGMA_AUTH_FLOW_PARITY_TASK022.md`); targeted auth E2E integration `auth-flow-e2e.task022d.integration.test.ts` (7 journeys); acceptance report `docs/plans/TASK_022D_AUTH_FLOW_ACCEPTANCE_REPORT.md`; handoff + ADR-005 + API doc updates.
- **AUTH FLOW (sandbox):** Verified end-to-end with mock provider + staff reviewer on Neon `strangeup_test`.
- **NOT VERIFIED:** Production Veriff, strict consent, prod email, OAuth, Admin UI, Home Figma (owner-supplied later).
- **Integration regression:** Full suite **not re-run** in 022D (022C baseline **117 passed**, 1 skipped).

---

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
| **Task 025A — Main Flow Home / main-shell** | **VERIFIED (docs + bounded tests)** | Nine-PDF manifest; Screen 09 audit correction; `FIGMA_MAIN_FLOW_PARITY_TASK025A.md`; OpenAPI 403 fix; `main-flow-025a.integration.test.ts`; report `docs/plans/TASK_025A_MAIN_FLOW_HOME_REPORT.md` |
| **Task 025B — Discover activation & Screen 09** | **VERIFIED (Neon)** | Discover targets require Task 022 activation; `discover-target-policy.ts`; T025B-P01/P02 + regression; `FIGMA_MAIN_FLOW_PARITY_TASK025B.md`; report `docs/plans/TASK_025B_DISCOVER_REPORT.md` |
| **Task 025C — Activities / Screen 11** | **VERIFIED (Neon)** | Activated-host discovery filter; host-aware `q` search; T025C-P01/P02; `FIGMA_MAIN_FLOW_PARITY_TASK025C.md`; report `docs/plans/TASK_025C_ACTIVITIES_REPORT.md` |
| **Task 025D — Profile / Settings / Edit details** | **VERIFIED (Neon)** | Legal name lock after KYC; `legalNameLocked` + `adminReviewStatus` on profile/settings; T025D-P01–P03; `FIGMA_MAIN_FLOW_PARITY_TASK025D.md`; report `docs/plans/TASK_025D_PROFILE_SETTINGS_REPORT.md` |
| **Task 025E — Main Flow final parity & E2E** | **VERIFIED (Neon)** | Consolidated matrix `FIGMA_MAIN_FLOW_PARITY_TASK025E.md`; sticky legal-name lock (025E); T025E-E01–E03, T025E-S01–S02; report `docs/plans/TASK_025E_MAIN_FLOW_FINAL_REPORT.md`; **Task 025 complete** |
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

1. **Owner review Task 030** — approve **Task 031** (separate-repo Admin Panel MVP) and/or **P0** ops: **MDWQ-0310** dev migrations + staff `IDENTITY_REVIEWER` grants.
2. **Staging E2E:** register → mock KYC → admin approve → Home (reuse 022D journey on staging URL).
3. **Release track (P1):** MDWQ-0099 full Neon regression; MDWQ-0101–0103 consent/email/media; MDWQ-0302 prod KYC when authorized.
4. **Product forks (owner-gated, unchanged):** D-08 billing **or** D-06 interactive media **or** MKT-03 checkout **or** 029G jobs — one scope at a time.
5. Owner: **SET-03** deletion; **SET-01** prod email; **MDWQ-0910** Figma re-export.
6. Git logical commits / remote when owner approves.
