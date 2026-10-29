# Open Product Decisions — Owner Review Queue

**State:** D-01, D-02 (core), D-02-AUTH, D-09 (core), **D-09-features**, and **D-09-kyc-enforcement (policy portion)** are **APPROVED** or **RESOLVED** as noted. KYC policy record: `KYC_OWNER_DECISIONS_002B3A2.md`.

| ID | Priority | Status | Decision required | Blocks |
|---|---|---|---|---|
| D-01 | P0 | **APPROVED** | USA launch; adults-only 18+ | — (subsequent legal review may refine copy) |
| D-02 | P0 | **APPROVED*** | Email, password, DOB, legal acceptance; email verification before full access | — |
| D-02-AUTH | P0 | **APPROVED** | Email/password Phase 1; defer Google, Apple, phone OTP | — |
| D-09 | P0 | **APPROVED*** | Separate email / age / KYC dimensions; no live KYC provider yet | — |
| D-02-phone | P0 | OPEN | Mandatory phone collection and verification at signup? | signup UX, SMS vendor |
| D-09-provider | P0 | OPEN | KYC vendor **selection** (KYC-02) — due diligence in `KYC_VENDOR_EVALUATION.md`; **no vendor chosen** | live verification |
| D-09-retention | P0 | OPEN | Retention/deletion for verification metadata and audit (post KYC-05 model) | compliance, ops |
| D-09-features | P0 | **APPROVED*** | KYC-01: gov ID before real-world meetup/activity participation & hosting | — |
| D-09-kyc-enforcement | P0 | **RESOLVED*** | Action gates KYC-ENF-01..05 (2026-10-26) | — |
| D-09-kyc-enforcement-ops | P0 | OPEN | Residual: waitlist timers, modality reclassification, remediation SLAs, appeals, API names | implementation detail |
| D-09-gates-ux | P0 | OPEN | Flutter copy, badges, prompts (KYC-07) | Flutter UX |
| D-03 | P0 | **APPROVED (MVP)*** | People discovery + public profile **read** rules — `D-03-public-profile-discovery-mvp.md`; Follow/Wave/Message **implemented** (Task 011) with provisional DM consent in `D-SOCIAL-TASK011.md` | remaining social owner choices |
| D-04 | P0 | **APPROVED (MVP)*** | City/region text on public DTOs + non-geo filters — `D-04-location-discovery-mvp.md`; geo/distance **deferred** | maps, activity geo |
| D-05 | P0 | **PARTIAL (Task 010)** | Conservative join/edit/cancel/waitlist-hold defaults shipped; see `D-ACTIVITIES-TASK010.md` | remaining cutoff, roster, skip-queue, Followers-only |
| D-06 | P0 | **PARTIAL (Task 016)** | Group defaults (Task 012) + interactive media **implemented disabled**; see `D-06-COMMUNITY-MEDIA-TASK016.md` | owner activation, personal stories, production media/moderation |
| D-07 | P0 | **PARTIAL** | Meetup eligibility/lifecycle — **foundation accepted** D-28 (2026-10-29); REST/notifications/reschedule still open | `D-28-personal-meetup-invitation-2026-10-29.md`, MDWQ-0721, MDWQ-0506 |
| D-08 | P0 | **OPEN (billing DEFERRED)** | Digital Club entitlements and billing — **owner 2026-10-28: defer all payment/subscription implementation**; read-only APIs LIVE | membership gates |
| D-10 | P0 | OPEN | E2EE messaging claim | chat, marketing copy |
| MKT-01 | P1 | **OPEN (PROVISIONAL)** | Platform-curated official merch vs P2P marketplace — Figma shows official gear store only | seller onboarding, payouts |
| MKT-02 | P1 | **OPEN (PROVISIONAL)** | Who publishes products, stock, and “official” status — **trusted operator-only** until role model approved | catalog ingestion |
| MKT-03 | P0 | **OPEN (DEFERRED)** | Tax, payment processor, refunds, fulfillment, pickup auth, inventory reservation, membership discounts, checkout enablement | orders/payment |
| MKT-04 | P1 | **OPEN (PROVISIONAL)** | Product image rights, reviews/ratings moderation, production CDN | store media |
| JOB-01 | P1 | **OPEN (PROVISIONAL)** | Who may publish jobs and assert verified employer / official partner | jobs go-live |
| JOB-02 | P1 | **OPEN (DEFERRED)** | Employer delivery channel, applicant consent copy, retention, moderation — applications **in-platform only** today | ATS/email integration |
| JOB-03 | P2 | **OPEN (PROVISIONAL)** | Compensation/location labels self-reported; no geo radius or distance ranking | jobs search UX |
| D-11 | P1 | OPEN | Marketplace model (see **MKT-01**) | store |
| D-12 | P1 | OPEN | Merchandise pricing/tax/refunds | orders/payment |
| D-13 | P1 | OPEN | Jobs and Stories MVP priority | scope, roadmap |
| D-14 | P1 | OPEN | Home #47 / Group #46 authority | navigation, spec |
| D-15 | P1 | OPEN | Abuse reporting and moderation SLA | trust/safety |
| D-16 | P1 | OPEN | Jobs publisher model | jobs |
| D-17 | P1 | OPEN | Admin panel expectations | moderation, shop |
| D-18 | P2 | **PARTIAL (Task 013)** | In-app pull inbox LIVE; push/email/WebSocket **OPEN** | notification integrations |
| D-18-retention | P2 | OPEN | Provisional 365-day `UserNotification` retention default in code constants — owner legal review | privacy, ops |
| D-06-stories | P0 | **PARTIAL (Task 016)** | Server 24h expiry + member ACL coded; Home row still DEFERRED until owner approves D06-01..07 | Home stories row LIVE |
| D-19 | P2 | OPEN | Load, residency, uptime | infra and SLO |

\*Approved core rule recorded in ADR-004 or KYC owner handoffs; starred rows may still have **open sub-decisions**. **D-09-kyc-enforcement\***: broad gates approved in `KYC_OWNER_DECISIONS_002B3A2.md` §B; track residuals under **D-09-kyc-enforcement-ops**.

**KYC register:** `KYC_REQUIREMENTS_DECISION_GATE.md` — **KYC-01/03/05 + ENF approved**; **KYC-02** see `KYC_VENDOR_EVALUATION.md`; **KYC-04** see `KYC_LIFECYCLE_DECISION_OPTIONS.md`; **KYC-06** see `KYC_PRIVACY_VENDOR_CHECKLIST.md`. APIs: `KYC_API_CANDIDATES.md` (**NOT IMPLEMENTED**).

## Task 015 — Settings & account lifecycle (PROVISIONAL until owner sign-off)

| ID | Status | Decision required | Engineering default (provisional) |
|---|---|---|---|
| SET-01 | **OPEN** | Email change reauth, challenge TTL, old-email notification, session revocation scope, passwordless/OAuth-only accounts | Password reauth required; reuse `AUTH_CHALLENGE_TTL_SECONDS`; revoke **all** sessions on confirm; dev stub only; OAuth-only → feature hidden/blocked |
| SET-02 | **OPEN** | Session inventory fields & retention | Expose `sessionId`, `createdAt`, `expiresAt`, `isCurrent`, `hasUserAgent` only; max 50 rows; no IP/location |
| SET-03 | **OPEN** | Account deletion vs deactivation; grace period; third-party content; group ownership; jobs; media/legal hold | **No destructive endpoint** shipped; impact API returns counts + `AWAITING_POLICY` |
| SET-04 | **OPEN** | Phone edit/verify without SMS transport | Read-only phone on overview/account; no write path |
| SET-05 | **OPEN** | Support/legal URLs, 2FA, membership/billing surfacing | `capabilities.subscription`/`paymentHistory` DEFERRED; **`membershipPlanCatalog` LIVE** (Task 017) — billing upgrade still not LIVE |
| SET-NAME-025D | **RESOLVED (engineering default)** | Self-serve legal name change after staff-approved identity binding | **`legalNameLocked` sticky** (Tasks 025D/025E); support/vendor correction only — owner may refine ops SLA |

## D-08 — Membership & commercial terms (owner checklist, Task 017)

**Status:** **Billing implementation DEFERRED (owner 2026-10-28, Task 026A).** Catalog/status APIs ship honest **NOT_CONFIGURED** billing; no charges, trials, or Club enrollment. Record: `docs/decisions/D-08-owner-defer-billing-2026-10-28.md`.

| # | Decision required | Notes |
|---|---|---|
| D-08-01 | Billing channels | Web Stripe vs Apple/Google IAP rules; tax, invoices, refunds jurisdiction |
| D-08-02 | Tier naming | Confirm **Basic Explorer** / **Strangeup Club** final; free default for all new accounts? |
| D-08-03 | Published prices | Approve or reject Figma **`$6.49/mo` billed annually (`$77.88/yr`)**, monthly list price, “35% savings”, **7-day trial** — eligibility, cancel/refund copy |
| D-08-04 | Benefit matrix | Which Figma perks are real product (3 monthly RSVPs, 5-mile radius, priority feed, VIP roles, concierge, private circles) vs marketing removal |
| D-08-05 | Lifecycle | Renewals, failed payment grace, chargebacks, webhook verification, idempotent entitlement grant/revoke |
| D-08-06 | Consent & marketing | Canonical terms IDs; Apple Pay surfacing; accurate “verified” / member badge copy (KYC remains separate — D-09) |

**Engineering until approved:** `GET /v1/membership/plans`, `GET /v1/me/membership`; `canUpgrade: false`; Club `pricing: null`; no subscription write APIs.

## Task 027 — After Membership Activities (PROVISIONAL — 027A source audit)

Figma package: `design-reference/task027-activities-post-membership/`. Parity matrix: `FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027A.md`. Master queue: MDWQ-0701, 0710–0713, 0704, 0702, 0703.

| ID | Status | Decision required | Blocks |
|---|---|---|---|
| ACT-APPROVAL | **CLOSED** (D-09, 027E) | Hybrid `AUTO` \| `HOST_APPROVAL` | — |
| ACT-CAPACITY | **OPEN** | Meaning of “Approved (8)” vs “6 of 10 spots filled” on same Join Requests frame | MDWQ-0712; use `hostParticipationSummary` in UI |
| ACT-ROSTER | **CLOSED** (027F conservative) | Host + CONFIRMED participant roster; not public | — |
| ACT-CHAT | **OPEN** | Activity “Message Group” vs existing community group chat | MDWQ-0711 |
| ACT-FOLLOW | **OPEN** | Followers-only publish (see D-ACTIVITIES-TASK010) | MDWQ-0702 |
| ACT-CUTOFF | **OPEN** | 2-hour edit/cancel before meetup (Create footer copy) | MDWQ-0703 |
| ACT-CATALOG | **OPEN** | Seed Yoga / Social & Dining vs current five activity categories | MDWQ-0713 |

**Engineering (027E shipped):** Hybrid join mode live per D-09. **Roster (027F):** do not implement until ACT-ROSTER owner sign-off (MDWQ-0717).

## Sign-off process

When a decision is made, record: ID, approved answer, who approved, approval date, impacted modules, Figma evidence IDs, acceptance tests and any new ADR. Updating a checkbox without recording the actual rule is insufficient.
