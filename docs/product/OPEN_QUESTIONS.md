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
| D-06 | P0 | **PARTIAL (Task 012)** | Conservative group defaults shipped; see `D-GROUPS-TASK012.md` | remaining catalog, cooldown, stories/photo/poll, unlisted groups |
| D-07 | P0 | OPEN | Meetup eligibility and lifecycle (non-KYC aspects) | invitations, notifications |
| D-08 | P0 | OPEN | Digital Club entitlements and billing | membership gates |
| D-10 | P0 | OPEN | E2EE messaging claim | chat, marketing copy |
| D-11 | P1 | OPEN | Marketplace model | store |
| D-12 | P1 | OPEN | Merchandise pricing/tax/refunds | orders/payment |
| D-13 | P1 | OPEN | Jobs and Stories MVP priority | scope, roadmap |
| D-14 | P1 | OPEN | Home #47 / Group #46 authority | navigation, spec |
| D-15 | P1 | OPEN | Abuse reporting and moderation SLA | trust/safety |
| D-16 | P1 | OPEN | Jobs publisher model | jobs |
| D-17 | P1 | OPEN | Admin panel expectations | moderation, shop |
| D-18 | P2 | OPEN | Notification transport | notification integrations |
| D-19 | P2 | OPEN | Load, residency, uptime | infra and SLO |

\*Approved core rule recorded in ADR-004 or KYC owner handoffs; starred rows may still have **open sub-decisions**. **D-09-kyc-enforcement\***: broad gates approved in `KYC_OWNER_DECISIONS_002B3A2.md` §B; track residuals under **D-09-kyc-enforcement-ops**.

**KYC register:** `KYC_REQUIREMENTS_DECISION_GATE.md` — **KYC-01/03/05 + ENF approved**; **KYC-02** see `KYC_VENDOR_EVALUATION.md`; **KYC-04** see `KYC_LIFECYCLE_DECISION_OPTIONS.md`; **KYC-06** see `KYC_PRIVACY_VENDOR_CHECKLIST.md`. APIs: `KYC_API_CANDIDATES.md` (**NOT IMPLEMENTED**).

## Sign-off process

When a decision is made, record: ID, approved answer, who approved, approval date, impacted modules, Figma evidence IDs, acceptance tests and any new ADR. Updating a checkbox without recording the actual rule is insufficient.
