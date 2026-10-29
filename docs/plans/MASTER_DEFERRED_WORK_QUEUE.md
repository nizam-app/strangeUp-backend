# StrangeUp — Master Deferred Work Queue

**Authoritative index:** single consolidated register of deferred, partial, owner-blocked, and release-blocking backend work across Tasks **001–030** (through **2026-10-29**, Task **030** backend completion audit).

**Not a substitute for:** per-task engineering reports, Figma parity matrices, ADRs, or `OPEN_QUESTIONS.md`. Those remain the detailed evidence; this file **indexes and reconciles** them.

**Update rule:** Any Cursor task that changes scope, deferrals, feature flags, release blockers, or owner decisions **must** update this file in the same change set (see `AGENTS.md`).

---

## Classification legend

| Class | Meaning |
|---|---|
| **OWNER_DEFERRED** | Explicit owner direction to not implement until re-authorized (record cites decision doc). |
| **DECISION_REQUIRED** | Engineering blocked on product/legal/ops sign-off; do not invent policy. |
| **TECHNICAL_PENDING** | Approved in principle or foundation exists; implementation, wiring, verification, or production activation remains. |
| **RELEASE_BLOCKER** | Must be resolved (or explicitly accepted as launch risk) before production release. |
| **COMPLETED** | Closed within **approved** backend scope; not “API exists” alone — behavior verified per task reports/tests. |

**Implementation status (column):** `NOT_STARTED` \| `PARTIAL` \| `FOUNDATION_ONLY` \| `DISABLED_BY_FLAG` \| `DEV_ONLY` \| `UNAVAILABLE_BY_CONTRACT` \| `VERIFIED_NEON` \| `NOT_VERIFIED`.

---

## ID scheme

- **MDWQ-####** — stable master queue IDs (never reuse; mark superseded in Notes).
- **Alias IDs** — existing registers (`D-*`, `MKT-*`, `SET-*`, `ACT-*`, `KYC-*`, `HOME-*`, etc.) preserved in **Decision / alias** column.

---

## Documentation reconciliation (conflicts & gaps)

| Issue | Resolution |
|---|---|
| `docs/plans/StrangeUp_ACTIVE_SCOPE_AND_DEFERRALS.md` (2026-10-26) vs `ACTIVE_SCOPE_AND_DEFERRALS.md` (2026-10-28) | **Canonical scope tracker:** `ACTIVE_SCOPE_AND_DEFERRALS.md`. Legacy file is **historical §4 policy archive only** — do not use its §2 implementation baseline. |
| `STATUS.md` Task 022B–D “local, not committed” vs current working tree | Treat **git state** as source for commit status; STATUS narrative may lag. Queue assumes **022A–D behavior present in source** per 2026-10-28 reports until owner rebases docs. |
| Follow graph **LIVE** (Task 011) vs `FOLLOWERS_ONLY` activity publish **rejected** | **Not a contradiction:** graph exists; **audience policy** for activities not enabled (`ACT-FOLLOW`). Requires product decision before publish/discovery enforcement. |
| MKT-02 “operator-only until approved” vs Task **024B** staff catalog APIs | **Reconciled:** operator tooling **implemented** behind `STORE_CATALOG_MANAGEMENT_ENABLED=false` + production fail-closed (`MKT-01`/`MKT-02` still **DECISION_REQUIRED** for go-live). |
| Screen 06 Sign Up (Figma) vs register API (DOB + consents) | **Documented conflict** — backend per D-02; Flutter must collect DOB/consents; not a backend deferral to “fix” without owner changing D-02. |
| `profileVisibility` stored (Task 008A) vs D-03 public reads | Field is **IMPLEMENTED**; **cross-user enforcement** of visibility modes beyond MVP D-03 rules remains **DECISION_REQUIRED** if product expands. |
| Membership **026B–026F** staged plan vs D-08 owner deferral (2026-10-28) | **026B+ ledger/payments** are **OWNER_DEFERRED** until billing re-authorized; do not start 026B automatically. |
| Full Neon regression | Repeatedly **deferred to release gate** in Tasks 023E, 024–026A — tracked as **RELEASE_BLOCKER** `MDWQ-0099`. |
| Task 026 membership PDFs | `design-reference/task026-membership/` manifest exists; owner asset completeness **not verified** in 026A report. |

---

## Ops / catalog drift (Task 030)

| ID | Class | Item | Source | Implementation status | Depends on | Priority | Decision / alias | References |
|---|---|---|---|---|---|---|---|---|
| MDWQ-0310 | TECHNICAL_PENDING | **`strangeup_dev` migration parity** — missing 028C + 028G vs repo (22) | Task 030 health check | **PARTIAL** (test **22/22**, dev **20/22**) | Ops `db:neon:migrate` on dev | P0 | — | `TASK_030_BACKEND_COMPLETION_AUDIT_REPORT.md` §A.5 |

---

## Cross-cutting release blockers

| ID | Class | Item | Source | Implementation status | Depends on | Priority | Decision / alias | References |
|---|---|---|---|---|---|---|---|---|
| MDWQ-0099 | RELEASE_BLOCKER | Full isolated Neon integration regression at release gate | Tasks 018–026A | NOT_VERIFIED (spot suites only) | CI time, `strangeup_test` | P0 | — | `STATUS.md`, `FIGMA_HEADER_FLOW_PARITY_TASK023.md` §10 |
| MDWQ-0100 | RELEASE_BLOCKER | Production deploy topology, secrets, remote, SLO | Task 018 | NOT_STARTED | Owner deploy authorization | P0 | D-19 | `STATUS.md`, `ROADMAP.md` |
| MDWQ-0101 | RELEASE_BLOCKER | Counsel **ACTIVE** consent version IDs + `CONSENT_ENFORCEMENT=strict` | Task 021, ADR-004 | PARTIAL (registry LIVE; IDs pending) | Legal/counsel | P0 | ADR-004 | `.env.example`, `STATUS.md`, `IDENTITY_ACCEPTANCE_MATRIX.md` |
| MDWQ-0102 | RELEASE_BLOCKER | Production transactional email (verify, reset, change) | Tasks 019/019B | FOUNDATION_ONLY (`dev_stub` default) | SET-01, Resend secrets | P0 | SET-01 | `FIGMA_AUTH_FLOW_PARITY_TASK022.md`, handoff env table |
| MDWQ-0103 | RELEASE_BLOCKER | Production media object storage (non-local disk) | Tasks 008A/020 | FOUNDATION_ONLY (`MEDIA_STORAGE_BACKEND=local` default) | Owner bucket approval | P0 | — | `MEDIA_OBJECT_STORAGE.md`, Task 008A report |
| MDWQ-0104 | RELEASE_BLOCKER | Distributed rate limiting activation in production | Task 019B | FOUNDATION_ONLY (Redis adapter; fail-closed on errors) | Upstash deploy | P1 | — | `STATUS.md` Task 019B |
| MDWQ-0105 | RELEASE_BLOCKER | Repository-wide LF / format drift normalization | Task 018 | TECHNICAL_PENDING | Owner one-time mechanical commit | P2 | — | `STATUS.md` Task 018 |

---

## Identity, auth & onboarding (Tasks 002, 022, 019)

| ID | Class | Item | Source (Task / Figma) | Implementation status | Depends on | Priority | Decision / alias | References |
|---|---|---|---|---|---|---|---|---|
| MDWQ-0201 | OWNER_DEFERRED | OAuth (Apple / Google) sign-in | D-02-AUTH; Screen 05 | NOT_STARTED | Provider contracts | P0 | D-02-AUTH | `FIGMA_AUTH_FLOW_PARITY_TASK022.md`, `OPEN_QUESTIONS.md` |
| MDWQ-0202 | DECISION_REQUIRED | Mandatory phone collection & SMS OTP at signup | Screen 06; D-02-phone | NOT_STARTED | SMS vendor | P0 | D-02-phone | `FIGMA_PROFILE_PARITY_MATRIX_2026-10-26.md` |
| MDWQ-0203 | OWNER_DEFERRED | Phone verify / edit write path | Task 015 | NOT_STARTED | SMS transport | P1 | SET-04 | `FIGMA_SETTINGS_PARITY_TASK015.md` |
| MDWQ-0204 | TECHNICAL_PENDING | Production email for verification & password reset | Task 019/019B | DEV_ONLY stub | MDWQ-0102 | P0 | SET-01 | `FIGMA_AUTH_FLOW_PARITY_TASK022.md` |
| MDWQ-0205 | DECISION_REQUIRED | Legacy email-active users admin backfill (ADR-005 forward-only) | Task 022D | PARTIAL (policy only) | Ops playbook | P1 | ADR-005 | `FIGMA_AUTH_FLOW_PARITY_TASK022.md` |
| MDWQ-0206 | TECHNICAL_PENDING | Admin UI for identity review (APIs LIVE) | Task 022B / **030** | FOUNDATION_ONLY (REST + OpenAPI; **no SPA**) | **Task 031** separate React repo | P0 (staging) | D-17 | `ADMIN_PANEL_API_READINESS_MATRIX.md`, `BACKEND_REMAINING_WORK_CHECKLIST.md` §5 |
| MDWQ-0207 | COMPLETED | Email/password auth, sessions, Task 022 home access gate | Tasks 002B, 022C | VERIFIED_NEON | — | — | ADR-005 | `FIGMA_AUTH_FLOW_PARITY_TASK022.md`, `access-enforcement.integration.test.ts` |
| MDWQ-0208 | COMPLETED | Onboarding status + admin approve/reject lifecycle | Task 022A–B | VERIFIED_NEON (bounded) | — | — | ADR-005 | `TASK_022D_AUTH_FLOW_ACCEPTANCE_REPORT.md` |

---

## KYC, verification & consent (Tasks 002B.3*, 021)

| ID | Class | Item | Source | Implementation status | Depends on | Priority | Decision / alias | References |
|---|---|---|---|---|---|---|---|---|
| MDWQ-0301 | DECISION_REQUIRED | KYC vendor selection (KYC-02) | 002B.3A3, Task 021 | NOT_STARTED (Veriff blocked) | Vendor contract | P0 | D-09-provider, KYC-02 | `KYC_VENDOR_EVALUATION.md`, `.env.example` |
| MDWQ-0302 | OWNER_DEFERRED | Live Veriff / production KYC provider | Task 021 | DISABLED_BY_FLAG (`KYC_PROVIDER_ENABLED`, `VERIFF_LIVE_CALLS_ENABLED`) | MDWQ-0301 | P0 | KYC-02 | `production-env-policy.ts` |
| MDWQ-0303 | DECISION_REQUIRED | KYC retry, appeal, outage, revocation detail (KYC-04) | 002B.3A3 | PARTIAL (ENF bounds only) | Counsel/ops | P0 | KYC-04 | `KYC_LIFECYCLE_DECISION_OPTIONS.md` |
| MDWQ-0304 | DECISION_REQUIRED | Verification metadata retention & deletion (KYC-06 / D-09-retention) | 002B.3A3 | NOT_STARTED | Legal | P0 | D-09-retention | `KYC_PRIVACY_VENDOR_CHECKLIST.md` |
| MDWQ-0305 | DECISION_REQUIRED | KYC ops: waitlist timers, modality, API names | Task 010 waitlist | NOT_STARTED | Product/ops | P1 | D-09-kyc-enforcement-ops | `D-ACTIVITIES-TASK010.md` ACT-WAITLIST |
| MDWQ-0306 | DECISION_REQUIRED | KYC Flutter copy & error surfaces (KYC-07) | — | NOT_STARTED (backend codes LIVE) | Flutter repo | P1 | D-09-gates-ux | `OPEN_QUESTIONS.md` |
| MDWQ-0307 | TECHNICAL_PENDING | Task **002B.3B** provider-neutral KYC foundation implementation | 002B.3A gate | NOT_STARTED ( **not authorized** ) | Owner explicit start | P0 | 002B.3B gate | `STATUS.md` §002B.3B, `cursor_tasks/StrangeUp_TASK_002B3A_*` |
| MDWQ-0308 | COMPLETED | Mock verification sessions + HMAC webhooks (CI) | Task 021 | VERIFIED_NEON | — | — | KYC-01/03/05, ENF | `membership` unaffected; Task 021 report |
| MDWQ-0309 | RELEASE_BLOCKER | Production KYC authority path (real approvals) | Task 010 ACT-KYC-PROD | UNAVAILABLE_BY_CONTRACT in prod without provider | MDWQ-0301–0302 | P0 | KYC-02 | `D-ACTIVITIES-TASK010.md` |

---

## Profile, discovery & main flow (Tasks 003–009, 025)

| ID | Class | Item | Source (Task / Figma) | Implementation status | Depends on | Priority | Decision / alias | References |
|---|---|---|---|---|---|---|---|---|
| MDWQ-0401 | DECISION_REQUIRED | Geo: map, distance, radius, nearest-first, presence | D-04; Screens 09/11 | NOT_STARTED | Location policy | P0 | D-04 | `FIGMA_MAIN_FLOW_PARITY_TASK025E.md`, `D-04-location-discovery-mvp.md` |
| MDWQ-0402 | DECISION_REQUIRED | Custom “Add Interest” free-text | Task 007 | NOT_STARTED | Catalog policy | P2 | D-03 | `D-INTERESTS-CATALOG-task007.md` |
| MDWQ-0403 | TECHNICAL_PENDING | Cross-user `profileVisibility` enforcement beyond D-03 MVP | Task 008A | PARTIAL (field stored; MVP reads scoped) | D-03 expansion | P1 | D-03 | `FIGMA_PROFILE_PARITY_MATRIX_2026-10-26.md` |
| MDWQ-0404 | TECHNICAL_PENDING | Verified location badge on profile | Screen 10 / Body-1 | NOT_STARTED | Geo/trust policy | P2 | D-04 | Profile parity matrix |
| MDWQ-0405 | DECISION_REQUIRED | Global federated search (header + main shell) | Task 023/025 | NOT_STARTED | Search product | P1 | — | `FIGMA_HEADER_FLOW_PARITY_TASK023.md`, `FIGMA_MAIN_FLOW_PARITY_TASK025E.md` |
| MDWQ-0406 | DECISION_REQUIRED | Authoritative Screen 08 Home variant | Task 025A | PARTIAL (superset API) | Product nav | P1 | HOME-08 | `FIGMA_MAIN_FLOW_PARITY_TASK025A.md`, `TASK_025A_MAIN_FLOW_HOME_REPORT.md` |
| MDWQ-0407 | DECISION_REQUIRED | Marketing metrics without server backing (host 4.98, “100% verified”, etc.) | Multiple Figma | NOT_STARTED | Copy/legal | P1 | COPY-TRUST | `FIGMA_MAIN_FLOW_PARITY_TASK025E.md` |
| MDWQ-0408 | COMPLETED | Main Flow tab APIs + Task 022 gate (025A–E) | Task 025 | VERIFIED_NEON (bounded E2E) | — | — | — | `TASK_025E_MAIN_FLOW_FINAL_REPORT.md` |
| MDWQ-0409 | COMPLETED | People discovery + public profile reads (D-03/D-04 MVP) | Task 009 | VERIFIED_NEON | — | — | D-03, D-04 | `D-03-public-profile-discovery-mvp.md` |
| MDWQ-0410 | COMPLETED | Legal name lock after staff-approved identity (025D/E) | Task 025D/E | VERIFIED_NEON | — | — | SET-NAME-025D | `profile-identity-policy.ts`, `TASK_025E_*` |

---

## Social, messaging & header flow (Tasks 011, 023)

| ID | Class | Item | Source | Implementation status | Depends on | Priority | Decision / alias | References |
|---|---|---|---|---|---|---|---|---|
| MDWQ-0501 | OWNER_DEFERRED | End-to-end encrypted messaging | Figma claims | NOT_STARTED | D-10 | P1 | D-10 | `D-SOCIAL-TASK011.md`, handoff §14 |
| MDWQ-0502 | OWNER_DEFERRED | Presence / online-active indicators | Header Flow | NOT_STARTED | Presence model | P2 | — | `FIGMA_HEADER_FLOW_PARITY_TASK023.md` |
| MDWQ-0503 | TECHNICAL_PENDING | Chat photos / attachments | Task 011/023 | NOT_STARTED (text-only) | Media policy | P1 | — | Header parity §4 |
| MDWQ-0504 | DECISION_REQUIRED | Mute / archive conversation threads | Header Flow | NOT_STARTED | Product | P2 | — | Header parity |
| MDWQ-0505 | DECISION_REQUIRED | Owner → member group invitations (≠ join request) | Header / groups | NOT_STARTED | D-GROUPS | P1 | — | Header parity §5 |
| MDWQ-0506 | OWNER_DEFERRED | Meetup invitation Accept/Decline **UX journey** (Figma vs API wiring) | Notifications PDF; Task 028 | **PARTIAL** (backend **028G** emitter live; Flutter/hub UX) | Owner UX sign-off | P0 | D-07, MEET-NOTIFY | `TASK_028G_PERSONAL_MEETUP_NOTIFICATIONS_REPORT.md` |
| MDWQ-0507 | TECHNICAL_PENDING | Staff account suspend/deactivate REST → socket disconnect | Task 023E | PARTIAL (hook exported; no writer) | D-17 | P1 | — | `FIGMA_HEADER_FLOW_PARITY_TASK023.md` §6 |
| MDWQ-0508 | TECHNICAL_PENDING | Production FCM push delivery | Task 023D | DISABLED_BY_FLAG (`PUSH_ENABLED=false`) | Firebase creds, owner auth | P0 | D-18 | `PUSH_DELIVERY_TASK023D.md`, `.env.example` |
| MDWQ-0509 | TECHNICAL_PENDING | Socket.IO Redis cluster adapter (horizontal scale) | Task 023B–D | DISABLED_BY_FLAG | Security review | P1 | — | `production-env-policy.ts`, handoff §14.5 |
| MDWQ-0510 | DECISION_REQUIRED | Group chat push notifications (`groupChatEnabled` default false) | Task 012/023 | PARTIAL (in-app only paths) | Group notif policy | P2 | — | Header parity §6 |
| MDWQ-0511 | COMPLETED | REST messaging summary + Socket.IO DM/group realtime (single instance) | Task 023A–B | VERIFIED_NEON (focused) | — | — | — | `messaging-socket.integration.test.ts` |
| MDWQ-0512 | COMPLETED | Device tokens + notification preferences APIs | Task 023C | VERIFIED_NEON | — | — | — | `push-devices.integration.test.ts` |
| MDWQ-0513 | DECISION_REQUIRED | In-app notification retention period (365-day code default) | Task 013 | PARTIAL (constant only) | Legal/privacy | P2 | D-18-retention | `OPEN_QUESTIONS.md` |
| MDWQ-0514 | OWNER_DEFERRED | Email notification delivery (non-transactional) | Task 013/023 | NOT_STARTED | ESP, product | P2 | D-18 | `FIGMA_HOME_FEED_NOTIFICATIONS_PARITY_TASK013.md` |

---

## Groups, home feed & community media (Tasks 012, 013, 016)

| ID | Class | Item | Source | Implementation status | Depends on | Priority | Decision / alias | References |
|---|---|---|---|---|---|---|---|---|
| MDWQ-0601 | OWNER_DEFERRED | Home “Community Stories” row LIVE | Screen 08 update; Task 013/016 | UNAVAILABLE_BY_CONTRACT (`stories.status: DEFERRED`) | D-06 owner activation | P0 | D-06, D06-stories | `FIGMA_GROUPS_STORIES_PARITY_TASK016.md` |
| MDWQ-0602 | OWNER_DEFERRED | Group stories, photo posts, polls **production activation** | Task 016 | DISABLED_BY_FLAG (`GROUP_COMMUNITY_INTERACTIVE_ENABLED=false`) | D06-01..07 sign-off | P0 | D-06 | `D-06-COMMUNITY-MEDIA-TASK016.md` |
| MDWQ-0603 | OWNER_DEFERRED | Personal “Your Story” | Task 016 | NOT_STARTED | D06-04 | P2 | D06-04 | `FIGMA_GROUPS_STORIES_PARITY_TASK016.md` |
| MDWQ-0604 | TECHNICAL_PENDING | Story expiry worker / scheduled cleanup (beyond manual script) | Task 016 | PARTIAL (manual script) | Ops | P2 | D06-02 | Task 016 plan |
| MDWQ-0605 | DECISION_REQUIRED | Verified Community badge | Groups Figma | NOT_STARTED | Trust/certification | P2 | — | `D-GROUPS-TASK012.md`, Header parity |
| MDWQ-0606 | TECHNICAL_PENDING | Photo/poll/share bodies in community feed | Task 013 | NOT_STARTED (text posts Task 012) | MDWQ-0602 | P1 | D-06 | `FIGMA_HOME_FEED_NOTIFICATIONS_PARITY_TASK013.md` |
| MDWQ-0607 | DECISION_REQUIRED | Abuse reporting & moderation SLA | — | NOT_STARTED | Trust/safety | P1 | D-15 | `OPEN_QUESTIONS.md` |
| MDWQ-0608 | COMPLETED | Groups core: discover, join, posts, comments, group chat REST | Task 012 | VERIFIED_NEON | — | — | D-GROUPS-TASK012 | `FIGMA_GROUPS_PARITY_MATRIX_2026-10-27.md` |
| MDWQ-0609 | COMPLETED | Home dashboard + in-app notification inbox (pull) | Task 013 | VERIFIED_NEON | — | — | D-18 partial | `FIGMA_HOME_FEED_NOTIFICATIONS_PARITY_TASK013.md` |

---

## Activities & meetups (Task 010, 025C, 027)

**Task 027I (2026-10-29):** Backend **COMPLETE WITHIN APPROVED SCOPE** — 027A–F verified; **027G SKIPPED** (per-subfeature owner gates); **027H SKIPPED** (ACT-NOTIFY); parity `FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027I_FINAL.md`; report `TASK_027I_FINAL_VERIFICATION_REPORT.md`. Open rows below remain for future owner authorization — not blockers for 027 closure.

| ID | Class | Item | Source | Implementation status | Depends on | Priority | Decision / alias | References |
|---|---|---|---|---|---|---|---|---|
| MDWQ-0701 | COMPLETED | Hybrid join mode **AUTO \| HOST_APPROVAL** (host approve/decline, PENDING lifecycle) | `Html → Body-1.pdf`; Task 027E; D-09 | VERIFIED_NEON (bounded) | — | P0 | ACT-APPROVAL | `D-09-activity-hybrid-join-mode-2026-10-29.md`, `TASK_027E_*` |
| MDWQ-0702 | DECISION_REQUIRED | `FOLLOWERS_ONLY` audience publish & discovery | Task 010 | PARTIAL (draft-only storage) | ACT-FOLLOW | P1 | ACT-FOLLOW, SOC-ACT | `D-ACTIVITIES-TASK010.md` |
| MDWQ-0703 | DECISION_REQUIRED | Two-hour edit/cancel cutoff | Figma Screen 13 | NOT_STARTED | ACT-CUTOFF | P2 | ACT-CUTOFF | `D-ACTIVITIES-TASK010.md` |
| MDWQ-0704 | COMPLETED | Confirmed attendee roster (host + CONFIRMED participant read) | Task 027F; Screen 12 | VERIFIED_NEON (bounded) | — | P2 | ACT-ROSTER | `TASK_027F_ATTENDEE_ROSTER_REPORT.md` |
| MDWQ-0705 | TECHNICAL_PENDING | Activity completion / archival automation | Task 010 | PARTIAL (enum only) | ACT-COMPLETED | P2 | ACT-COMPLETED | `D-ACTIVITIES-TASK010.md` |
| MDWQ-0706 | TECHNICAL_PENDING | Cancel/block notifications & refunds | Task 010 | NOT_STARTED | ACT-NOTIFY | P2 | D-07 | `D-ACTIVITIES-TASK010.md` |
| MDWQ-0707 | OWNER_DEFERRED | Activity payments / ticketing | Figma | NOT_STARTED | MKT-03 / billing | P2 | — | Activities parity matrix |
| MDWQ-0708 | COMPLETED | Core activity CRUD, RSVP, waitlist, meeting privacy, KYC gates | Task 010 | VERIFIED_NEON | — | — | D-05 partial | `FIGMA_ACTIVITIES_PARITY_MATRIX_2026-10-27.md` |
| MDWQ-0709 | COMPLETED | Activated-host discovery filter + host-aware search (025C) | Task 025C | VERIFIED_NEON | — | — | — | `TASK_025C_ACTIVITIES_REPORT.md` |
| MDWQ-0714 | COMPLETED | My Activities **pending** inventory view (`view=pending`, `PENDING_APPROVAL` relationship) | `Html → Body.pdf`; Task 027E | VERIFIED_NEON (bounded) | — | P0 | ACT-APPROVAL | `TASK_027E_*`, MDWQ-0701 |
| MDWQ-0715 | COMPLETED | Saved activities list/save — 025C host discoverability (conceal, preserve rows) | Task 015; 027D | VERIFIED_NEON (bounded) | — | P2 | — | `TASK_027D_ACTIVITIES_MANAGE_REPORT.md` |
| MDWQ-0710 | COMPLETED | My Activities unified tabs (Upcoming / Hosting / Joined / Waitlisted / Past read model) | `Html → Body.pdf`; Task 027B | VERIFIED_NEON (bounded) | — | P2 | — | `TASK_027B_ACTIVITIES_POST_MEMBERSHIP_REPORT.md` |
| MDWQ-0711 | DECISION_REQUIRED | Activity-scoped **Message Group** (vs community group chat only) | `Html → Body.pdf`; Task 027A | NOT_STARTED | ACT-CHAT | P2 | ACT-CHAT | `FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027A.md` |
| MDWQ-0712 | DOCUMENTED | Join Requests capacity counters — **do not copy Figma**; use `hostParticipationSummary` | `Html → Body-1.pdf`; Task 027E | IMPLEMENTED (server counters) | Product copy TBD | P1 | ACT-CAPACITY | `TASK_027E_*`, D-09 |
| MDWQ-0713 | DECISION_REQUIRED | Create Activity category catalog (Figma Yoga / Social & Dining vs server seed) | `Screen 13_ Create Activity.pdf`; Task 027A | PARTIAL (5 slugs seeded) | ACT-CATALOG | P2 | ACT-CATALOG | `activity-catalog.ts`, 027A parity matrix |
| MDWQ-0716 | COMPLETED | Task 027E security regression (concurrency, meeting gates, block/KYC at approve, FIFO) | Task 027F pre-audit | VERIFIED_NEON (bounded) | — | P1 | — | `TASK_027E_SECURITY_VERIFICATION_AUDIT.md` |
| MDWQ-0717 | COMPLETED | ACT-ROSTER conservative policy implemented (027F) | Task 027F | VERIFIED_NEON (bounded) | — | P2 | ACT-ROSTER | MDWQ-0704 |
| MDWQ-0718 | TECHNICAL_PENDING | Settings `counts.savedActivities` vs **visible** saved list (025C filter) | Task 027D; Screen 26 | PARTIAL (raw DB count) | — | P2 | — | `TASK_027D_*`, `TASK_027I_*` |
| MDWQ-0719 | DECISION_REQUIRED | Reapply to activity after host **DECLINED** (`HOST_APPROVAL`) | D-09; Task 027E | IMPLEMENTED deny (**409**) | Product policy | P2 | ACT-APPROVAL | `activity-join-policy.ts`, D-09 |

**027G skipped (closure):** MDWQ-0711, 0702, 0703, 0713 — retain as **DECISION_REQUIRED**; do not implement without separate owner phase.  
**027H skipped (closure):** MDWQ-0706 — retain as **TECHNICAL_PENDING** / **NOT_STARTED** until ACT-NOTIFY authorized.

---

## Personal direct meetup invitations (Task 028 — Discover & meetup flow)

**028H (2026-10-29):** Backend **READY_FOR_OWNER_REVIEW** — REST 028D–E, notifications 028G, parity `FIGMA_DISCOVER_MEETUP_PARITY_TASK028H_FINAL.md`. `capabilities.meetupInvites` **DEFERRED** until owner LIVE sign-off. **Distinct from** Task 027E Activity join approval.

**028C foundation (2026-10-29):** D-28 **Accepted (foundation scope)** — Prisma `PersonalMeetupInvitation` + policy/state modules + unit/schema tests. **No HTTP/notifications.** Report: `TASK_028C_PERSONAL_MEETUP_FOUNDATION_REPORT.md`. **028D gated.**

| ID | Class | Item | Source (Task / Figma) | Implementation status | Depends on | Priority | Decision / alias | References |
|---|---|---|---|---|---|---|---|---|
| MDWQ-0720 | COMPLETED | Personal meetup **eligibility** (discoverable target + block; no follow/DM required) | D-28 owner 2026-10-29 | **FOUNDATION_ONLY** (policy; HTTP 028D) | — | P0 | MEET-ELIGIBILITY, D-07 | `meetup-invite-policy.ts`, D-28 |
| MDWQ-0721 | COMPLETED | Personal meetup **REST** (full lifecycle) | Task 028 PDFs | VERIFIED_NEON (028D–E + 028H) | — | P0 | — | `TASK_028H_FINAL_VERIFICATION_REPORT.md` |
| MDWQ-0722 | COMPLETED | Meetup **venue visibility** (pre-accept redaction MVP) | D-28 owner 2026-10-29 | **FOUNDATION_ONLY** (mapper 028D) | — | P0 | MEET-LOCATION | `meetup-invite-venue-redaction.ts`; maps deferred |
| MDWQ-0723 | COMPLETED | Meetup invitation **lifecycle** (five states, lazy expiry, one pending/pair) | D-28 owner 2026-10-29 | **FOUNDATION_ONLY** (persist expire 028D) | — | P0 | MEET-STATE | `meetup-invite-state.ts`, migration partial unique |
| MDWQ-0724 | OWNER_DEFERRED | Meetup **reschedule / counter-proposal** workflow | Details PDF (button only) | NOT_STARTED | MEET-RESCHEDULE | P1 | MEET-RESCHEDULE | Task 028 plan §2; excluded from 028C–E MVP |
| MDWQ-0725 | COMPLETED | Meetup **datetime & note** validation (future + IANA TZ + note ≤200) | D-28 / 028C | **FOUNDATION_ONLY** (pure validation module) | 028D wire-up | P1 | MEET-DATETIME | `meetup-invite-validation.ts`; **duration/end still OPEN** |
| MDWQ-0729 | COMPLETED | Persist lazy **EXPIRED** on list/detail (no background worker) | 028D | VERIFIED_NEON (bounded) | — | P1 | MEET-STATE | `meetup-invite-expiry.ts` |
| MDWQ-0731 | COMPLETED | Task **028D** meetup invite create + inbox + detail REST | Task 028D | VERIFIED_NEON (5/5) | — | P0 | D-28 | `TASK_028D_PERSONAL_MEETUP_REST_REPORT.md` |
| MDWQ-0732 | COMPLETED | Task **028G** meetup notification implementation (4 events) | 028G 2026-10-29 | VERIFIED_NEON (9/9) | — | P0 | MEET-NOTIFY | `TASK_028G_PERSONAL_MEETUP_NOTIFICATIONS_REPORT.md` |
| MDWQ-0733 | COMPLETED | Task **028H** final parity + bounded E2E verification | 028H 2026-10-29 | VERIFIED_NEON (028H suite) | — | P0 | D-28 | `TASK_028H_FINAL_VERIFICATION_REPORT.md` |
| MDWQ-0726 | DECISION_REQUIRED | Screen 10 **profile enrichments** (upcoming activities, groups, recent activity, mutual banner) | Screen 10 PDF | NOT_STARTED | Activity/group public APIs | P2 | COPY-TRUST | Separate from core invite domain |
| MDWQ-0727 | COMPLETED | Task **028A** read-only source audit + parity matrix | Task 028A | DOCUMENTED | — | — | — | `TASK_028A_DISCOVER_MEETUP_AUDIT_REPORT.md` |
| MDWQ-0728 | COMPLETED | Task **028B** policy proposal + API/state contract (documentation) | Task 028B | DOCUMENTED | — | — | D-28 | `TASK_028B_DISCOVER_MEETUP_POLICY_AND_CONTRACT.md` |
| MDWQ-0730 | COMPLETED | Task **028C** Prisma + policy/state foundation | Task 028C | VERIFIED_NEON (schema 2/2) | — | P0 | D-28 | `TASK_028C_PERSONAL_MEETUP_FOUNDATION_REPORT.md` |

---

## Marketplace, store & physical commerce (Tasks 014, 024A–D)

| ID | Class | Item | Source | Implementation status | Depends on | Priority | Decision / alias | References |
|---|---|---|---|---|---|---|---|---|
| MDWQ-0801 | OWNER_DEFERRED | Checkout, payments, tax, refunds (physical store) | Tasks 014/024; Screen 22 | UNAVAILABLE_BY_CONTRACT (`checkout.status=UNAVAILABLE`) | MKT-03, 024E owner | P0 | MKT-03, D-12 | `FIGMA_MARKETPLACE_PARITY_TASK024A.md` |
| MDWQ-0802 | OWNER_DEFERRED | Phase **024E** — chargeable checkout & payment webhooks | Task 024 plan | NOT_STARTED | MDWQ-0801, processor | P0 | MKT-03 | `cursor_tasks/StrangeUp_TASK_024_*`, `STORE_FULFILLMENT_ORDER_ARCHITECTURE_TASK024D.md` |
| MDWQ-0803 | DECISION_REQUIRED | Marketplace model: official merch vs P2P | Screen 20 | NOT_STARTED | MKT-01, D-11 | P1 | MKT-01, D-11 | `OPEN_QUESTIONS.md` |
| MDWQ-0804 | DECISION_REQUIRED | Trusted publisher / “official” product policy | Task 024B | PARTIAL (staff role coded) | MKT-02 | P1 | MKT-02 | `STORE_CATALOG_MANAGEMENT_TASK024B.md` |
| MDWQ-0805 | TECHNICAL_PENDING | Staff catalog CRUD **production enablement** | Task 024B | DISABLED_BY_FLAG (`STORE_CATALOG_MANAGEMENT_ENABLED=false`) | MDWQ-0803–0804 | P1 | MKT-02 | `production-env-policy.ts` |
| MDWQ-0806 | TECHNICAL_PENDING | Prisma order/inventory transactional models | Task 024D | NOT_STARTED (TS contract only) | MKT-03 | P0 | MKT-03 | `STORE_FULFILLMENT_ORDER_ARCHITECTURE_TASK024D.md` |
| MDWQ-0807 | DECISION_REQUIRED | Shipping/pickup selection persistence & policy | Screen 22 | PARTIAL (fulfillment-policy read) | MKT-03 | P0 | MKT-03 | Task 024D doc |
| MDWQ-0808 | OWNER_DEFERRED | Product reviews & ratings | Screens 20–21 | NOT_STARTED | MKT-04 | P2 | MKT-04 | `FIGMA_MARKETPLACE_JOBS_PARITY_TASK014.md` |
| MDWQ-0809 | OWNER_DEFERRED | Club member pricing / cart discount enforcement | Tasks 024C/026A | UNAVAILABLE_BY_CONTRACT (`NOT_CONFIGURED`) | D-08, MKT-03 | P0 | D-08-04, MKT-03 | `STORE_PRICING_CLUB_CONTRACT_TASK024C.md` |
| MDWQ-0810 | TECHNICAL_PENDING | Store product images on production CDN/S3 (buyer path) | Task 020/024B | PARTIAL (admin ingest; buyer route legacy local fallback) | MDWQ-0103 | P2 | MKT-04 | Task 024B report |
| MDWQ-0811 | COMPLETED | Catalog browse, cart integrity, favorites (024A) | Task 024A | VERIFIED_NEON (bounded) | — | — | — | `store-cart-024a.integration.test.ts` |
| MDWQ-0812 | COMPLETED | Pricing quote + fulfillment-policy **non-transactional** contracts (024C–D) | Task 024C–D | VERIFIED_NEON (bounded) | — | — | ADR-003 | `store-pricing-024c`, `store-fulfillment-024d` tests |

---

## Jobs (Task 014)

| ID | Class | Item | Source | Implementation status | Depends on | Priority | Decision / alias | References |
|---|---|---|---|---|---|---|---|---|
| MDWQ-0901 | DECISION_REQUIRED | Who may publish jobs / verified employer | Screen 23 | NOT_STARTED | JOB-01, D-16 | P1 | JOB-01, D-16 | `FIGMA_MARKETPLACE_JOBS_PARITY_TASK014.md` |
| MDWQ-0902 | OWNER_DEFERRED | Employer delivery channel (ATS/email) | Task 014 | UNAVAILABLE_BY_CONTRACT (`employerDelivery.status=NOT_CONFIGURED`) | JOB-02 | P1 | JOB-02 | Task 014 plan |
| MDWQ-0903 | DECISION_REQUIRED | Jobs geo radius / distance ranking | Screen 23 | NOT_STARTED | D-04 | P2 | JOB-03 | `OPEN_QUESTIONS.md` |
| MDWQ-0904 | COMPLETED | In-platform job list, detail, self applications | Task 014; Screen 23 (029F) | VERIFIED_NEON (bounded 029F) | — | — | — | `TASK_029F_JOBS_DISCOVERY_SAVED_REPORT.md`, `store-jobs.integration.test.ts` |
| MDWQ-0905 | DECISION_REQUIRED | Job application **withdrawal** and post-submit status transitions | Task 014; Screen 23 | PARTIAL (enum only; submit + self-read) | JOB-02, MDWQ-0902 | P1 | JOB-02 | `TASK_029A_GROUPS_JOBS_SOURCE_AUDIT_REPORT.md` |
| MDWQ-0906 | TECHNICAL_PENDING | Saved / Applications **tab badge counts** (Jobs screen) | Task 029; Screen 23 | NOT_STARTED | — | P2 | — | `FIGMA_GROUPS_JOBS_PARITY_TASK029A.md` |

---

## Groups & Jobs flow audit (Task 029A)

| ID | Class | Item | Source | Implementation status | Depends on | Priority | Decision / alias | References |
|---|---|---|---|---|---|---|---|---|
| MDWQ-0910 | RELEASE_BLOCKER | Task 029 **`Html → Body.pdf` packaging** — My Groups screen missing (duplicate of updated Group Details) | Task 029 ZIP / MANIFEST | SOURCE_ERROR | Owner re-export | P0 | GRP-SOURCE-01 | `TASK_029A_*`, `design-reference/task029-groups-jobs/MANIFEST.md` |
| MDWQ-0911 | DECISION_REQUIRED | **Authoritative Group Details** Figma — original (Posts/Members/About) vs updated (+Stories/Chat/Meetups) | Two Screen 15 PDFs | NOT_STARTED | D-06 for Stories tab | P0 | GRP-DETAILS-01 | `FIGMA_GROUPS_JOBS_PARITY_TASK029A.md` |
| MDWQ-0912 | TECHNICAL_PENDING | My Groups **tab aggregate counts** (All/Joined/Managed/Pending) | Task plan; Screen 14 historical | PARTIAL (`view` presets on `/v1/me/groups`; counts client-side) | MDWQ-0910 source | P2 | — | `TASK_029B_GROUPS_READ_INVENTORY_REPORT.md` |
| MDWQ-0913 | TECHNICAL_PENDING | Group Details **tab badge counts** (chat/meetups/members) | Updated Screen 15 | NOT_STARTED | — | P2 | — | Task 029A parity matrix |
| MDWQ-0914 | DECISION_REQUIRED | **Secret / unlisted** private groups (vs discoverable `PRIVATE_APPROVAL` summaries) | D-GROUPS GRP-DISC | PARTIAL (discover lists private summaries) | GRP-DISC-01 | P1 | D-GROUPS | `D-GROUPS-TASK012.md` |
| MDWQ-0915 | TECHNICAL_PENDING | Manage dashboard **weekly activity deltas** (“+12 this wk”) | Screen 2 | NOT_STARTED | COPY-TRUST | P2 | — | Task 029A |

**029A audit only:** no 029B–H implementation authorized by this queue update.

---

## Membership & billing (Tasks 017, 026A)

| ID | Class | Item | Source | Implementation status | Depends on | Priority | Decision / alias | References |
|---|---|---|---|---|---|---|---|---|
| MDWQ-1001 | OWNER_DEFERRED | **All** payment & subscription billing (Club, IAP, Stripe, trials, restore) | Task 026A; Screen 18 | OWNER_DEFERRED per D-08 2026-10-28 | Commercial sign-off | P0 | D-08 | `D-08-owner-defer-billing-2026-10-28.md` |
| MDWQ-1002 | DECISION_REQUIRED | Club SKU prices, intervals, trial terms | Figma Screen 18 | NOT_STARTED (listed as contradictions in API) | D-08-03 | P0 | D-08-03 | `FIGMA_MEMBERSHIP_PARITY_TASK026A.md` |
| MDWQ-1003 | DECISION_REQUIRED | Enforceable benefit matrix (RSVP caps, radius, VIP, etc.) | Figma perks | NOT_STARTED (`NOT_CONFIGURED` / `NOT_IMPLEMENTED`) | D-08-04 | P0 | D-08-04 | `membership-flow-contract.ts` |
| MDWQ-1004 | TECHNICAL_PENDING | Phase **026B** subscription ledger schema (no payments) | Task 026 plan | NOT_STARTED | Owner re-authorize billing track | P0 | D-08-05 | `cursor_tasks/StrangeUp_TASK_026_*` |
| MDWQ-1005 | TECHNICAL_PENDING | Post-purchase / manage subscription APIs | — | NOT_STARTED | Figma + D-08-05 | P1 | D-08-05 | `TASK_026A_MEMBERSHIP_FLOW_REPORT.md` |
| MDWQ-1006 | COMPLETED | Read-only plans + self membership **`flow`** honest contract (026A) | Task 026A | VERIFIED_NEON (bounded) | — | — | — | `FIGMA_MEMBERSHIP_PARITY_TASK026A.md`, `membership-flow-contract.test.ts` |
| MDWQ-1007 | COMPLETED | Task 017 registry + settings overview membership summary (pre-026A baseline) | Task 017 | VERIFIED_NEON | Superseded by 026A `flow` | — | — | `FIGMA_MEMBERSHIP_PARITY_TASK017.md` |

---

## Settings & account lifecycle (Task 015, 025D)

| ID | Class | Item | Source | Implementation status | Depends on | Priority | Decision / alias | References |
|---|---|---|---|---|---|---|---|---|
| MDWQ-1101 | DECISION_REQUIRED | Destructive account deletion workflow | Screen 26 | NOT_STARTED (impact API only) | SET-03 | P0 | SET-03 | `FIGMA_SETTINGS_PARITY_TASK015.md` |
| MDWQ-1102 | DECISION_REQUIRED | 2FA | Screen 26 | NOT_STARTED | SET-05 | P1 | SET-05 | Settings parity |
| MDWQ-1103 | TECHNICAL_PENDING | Production email change (confirm flow) | Task 015 | DEV_ONLY / prod `403 FEATURE_DISABLED` | MDWQ-0102, SET-01 | P1 | SET-01 | Task 018 production gates |
| MDWQ-1104 | DECISION_REQUIRED | Support / legal / guidelines URLs | Settings hub | NOT_STARTED | Content owner | P2 | SET-05 | Settings parity |
| MDWQ-1105 | DECISION_REQUIRED | Blocked users management UI/API expansion | Task 005 umbrella | PARTIAL (blocks exist Task 009) | Product | P2 | — | `STATUS.md` Task 005 umbrella |
| MDWQ-1106 | OWNER_DEFERRED | Subscription row, payment history, renewal dates in settings | Screen 26 | UNAVAILABLE_BY_CONTRACT | MDWQ-1001 | P0 | SET-05, D-08 | `capabilities` in settings overview |
| MDWQ-1107 | COMPLETED | Settings overview, saved activities, sessions, password change | Tasks 005/015 | VERIFIED_NEON | — | — | — | `FIGMA_SETTINGS_PARITY_TASK015.md` |

---

## Task & milestone index (001–026A)

| Task | Primary queue domains | Staged phases **not started** (owner-gated) |
|---|---|---|
| 001 / 001.1 | Foundation | — |
| 002A–002B.3A3 | Auth, KYC **docs** | **002B.3B** implementation |
| 003 / 003A | Profile safe slice | — |
| 004 | — | **CANCELLED** (Flutter external) |
| 005 | Settings (slice 1) | Umbrella: 2FA, delete, blocked users |
| 006–008A | Profile fields | Production avatar CDN |
| 009 | Discovery | Geo (D-04) |
| 010 | Activities | ACT-APPROVAL, roster, payments |
| 011 | Social/DM | E2EE, media, presence |
| 012 | Groups | Stories/polls (→016) |
| 013 | Home/notifications | Stories, push |
| 014 | Store/jobs | Checkout, employer delivery |
| 015 | Settings lifecycle | Delete, 2FA, prod email |
| 016 | Interactive media | **Activation** (D-06) |
| 017 | Membership read | Billing (→026) |
| 018 | Release hardening | Deploy, full regression |
| 019 / 019B | Email/rate limit adapters | Live vendor activation |
| 020 | Media storage | S3 prod activation |
| 021 | KYC/consent | Veriff, counsel IDs |
| 022A–D | Auth/onboarding gate | Admin UI, prod Veriff |
| 023A–E | Header/messaging/push | FCM prod, Redis socket, suspend API |
| 024A–D | Marketplace foundations | **024E** payments |
| 025A–E | Main flow audit | HOME-08, COPY-TRUST |
| 026A | Membership flow contract | **026B–026F** (billing deferred) |
| 027 | After-membership activities | **027I COMPLETE** within scope; **027G/H SKIPPED** |
| 028 | Personal direct meetup invites | **028H COMPLETE** — **READY_FOR_OWNER_REVIEW**; capability **DEFERRED**; **028F** reschedule deferred |
| 029A | Groups & Jobs source audit | **COMPLETE** (read-only) |
| 029B | Groups discover/detail/My Groups read inventory | **COMPLETE** (bounded) |
| 029C | Create & manage group dashboard | **COMPLETE** (archived settings/cover guard) |
| 029D | Membership lifecycle & authorization | **COMPLETE** (archived membership guards + socket on remove) |
| 029E | Interactive group Stories/polls/photo | **SKIPPED** (Task 029 closure; D-06 / Task 016 flag — queue rows **open**) |
| 029F | Jobs discovery & saved (Screen 23 read) | **COMPLETE** (`q`+`cursor` fix; T029F-P01–P04) |
| 029G | Job applications lifecycle & publish | **SKIPPED** (Task 029 closure — **MDWQ-0901**, **0902**, **0905** **remain open**) |
| 029H | Final Groups & Jobs verification | **COMPLETE** — Task **029 COMPLETE WITHIN APPROVED SCOPE** |
| **029 (overall)** | Groups & Jobs staged flow | **COMPLETE WITHIN APPROVED SCOPE** — not full Figma / not prod-ready |
| **030** | Backend completion + Admin Panel readiness audit | **COMPLETE** (documentation only) |
| **031** (proposed) | React Admin Panel (separate repo) | **NOT STARTED** — owner authorization; reuse 022B APIs |

---

## Task 029 — remaining gaps after 029H (by class)

| Class | Representative MDWQ / notes |
|---|---|
| **RELEASE_BLOCKER** | **0910** — My Groups PDF packaging (**visual parity UNVERIFIED**) |
| **DECISION_REQUIRED** | **0911** (Group Details authority), **0901** (job publish), **0905** (application withdrawal/transitions), **0914** (secret/unlisted groups), **0505** (group invites) |
| **OWNER_DEFERRED** (product — not cancelled) | **0902** (employer delivery), **0903** (jobs geo), D-06 interactive (**029E skipped**), MKT/billing elsewhere |
| **TECHNICAL_PENDING / optional** | **0912**, **0913**, **0915**, **0906** (tab badge counts), **0099** (full Neon regression at release) |

**029E / 029G skip rule:** Skipped only for Task 029 closure. Do **not** treat skipped items as implemented, cancelled, or permanently owner-deferred without a separate owner decision.

---

## Completed within approved scope (reference only)

These are **not** open queue items; listed to avoid re-opening closed work or mistaking API presence for product completion.

| ID | Closed item | Evidence |
|---|---|---|
| MDWQ-0207 | Core identity auth + sessions | Task 002B.2A verification |
| MDWQ-0208 | Admin activation gate (022) | ADR-005, 022D E2E |
| MDWQ-0308 | Mock KYC sessions (non-prod) | Task 021 |
| MDWQ-0408–0410 | Main flow bounded parity + legal name lock | Task 025E report |
| MDWQ-0409 | D-03/D-04 MVP discovery | Task 009 |
| MDWQ-0511–0512 | Messaging summary + sockets + device tokens | Task 023 |
| MDWQ-0608–0609 | Groups core + home/inbox | Tasks 012–013 |
| MDWQ-0708–0709 | Activities core + 025C | Tasks 010, 025C |
| MDWQ-0710 | My Activities inventory read model | Task 027B |
| MDWQ-0701, 0714, 0716, 0717 | Hybrid join + security + roster (027E–F) | Task 027I report |
| MDWQ-0715 | Saved activities host-eligibility parity | Task 027D |
| MDWQ-0811–0812 | Store cart/pricing/fulfillment **non-payment** | Tasks 024A–D |
| MDWQ-0904 | Jobs apply in-platform | Task 014 |
| MDWQ-1006–1007 | Membership read-only honesty | Tasks 017, 026A |
| MDWQ-1107 | Settings hub core | Task 015 |

---

## Source document index

| Document | Role |
|---|---|
| `docs/plans/STATUS.md` | Chronological task completion narrative |
| `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md` | Active scope tracker (canonical) |
| `docs/product/OPEN_QUESTIONS.md` | Owner decision register (D-*, MKT-*, SET-*) |
| `docs/decisions/*.md`, `docs/decisions/ADR-*.md` | Approved / deferred decisions |
| `docs/product/FIGMA_*PARITY*.md` | Figma ↔ API matrices |
| `docs/plans/TASK_*_REPORT.md` | Task engineering reports (022D, 025A–E, 026A, 027A–I, **028A–H**, **029A–F**) |
| `docs/product/FIGMA_GROUPS_JOBS_PARITY_TASK029A.md` | Task 029 Groups & Jobs Figma ↔ API matrix |
| `docs/product/FIGMA_GROUPS_JOBS_PARITY_TASK029C.md` | Task 029 Create/Manage screen parity |
| `docs/plans/TASK_029C_GROUPS_CREATE_MANAGE_REPORT.md` | Task 029C engineering report |
| `docs/plans/TASK_029D_GROUPS_MEMBERSHIP_LIFECYCLE_REPORT.md` | Task 029D membership audit |
| `docs/product/FIGMA_GROUPS_JOBS_PARITY_TASK029D.md` | Task 029D membership parity |
| `docs/plans/TASK_029F_JOBS_DISCOVERY_SAVED_REPORT.md` | Task 029F Jobs discovery/saved audit |
| `docs/product/FIGMA_GROUPS_JOBS_PARITY_TASK029F.md` | Task 029F Screen 23 parity |
| `docs/plans/TASK_029H_FINAL_VERIFICATION_REPORT.md` | Task 029H closure verification |
| `docs/plans/TASK_030_BACKEND_COMPLETION_AUDIT_REPORT.md` | Task 030 backend completion audit |
| `docs/plans/ADMIN_PANEL_API_READINESS_MATRIX.md` | Admin Panel ↔ API matrix |
| `docs/plans/BACKEND_REMAINING_WORK_CHECKLIST.md` | P0/P1/P2 + Task 031 phases |
| `docs/product/FIGMA_GROUPS_JOBS_PARITY_TASK029H_FINAL.md` | Task 029 final Groups & Jobs parity matrix |
| `docs/product/FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027I_FINAL.md` | Task 027 final four-screen parity (closure) |
| `docs/product/FIGMA_DISCOVER_MEETUP_PARITY_TASK028A.md` | Task 028 Figma ↔ backend parity (personal meetup) |
| `docs/decisions/D-28-personal-meetup-invitation-PROPOSAL-2026-10-29.md` | Task 028B policy proposal (**not approved**) |
| `docs/product/MEETUP_INVITATION_API_CONTRACT_DRAFT.md` | Task 028B REST/Prisma draft |
| `docs/plans/TASK_028B_OWNER_DECISION_CHECKLIST.md` | Owner sign-off before 028C |
| `docs/product/FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027A.md` | Task 027 after-membership activities parity |
| `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` | Integration contract + env/feature flags |
| `cursor_tasks/StrangeUp_TASK_*` | Original staged execution plans |
| `src/config/env.ts`, `production-env-policy.ts` | Runtime flags & production fail-closed rules |

---

**Last consolidated:** 2026-10-29 (Task **030** audit — **031** Admin Panel proposed; **MDWQ-0310** dev migration drift).  
**Next maintainer action:** Owner review Task 030 deliverables; authorize **Task 031** and/or apply **MDWQ-0310** on dev; re-export My Groups PDF (**MDWQ-0910**); MDWQ-0099 full Neon at release.
