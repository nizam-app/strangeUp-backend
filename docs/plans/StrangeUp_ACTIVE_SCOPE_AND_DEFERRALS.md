# StrangeUp — Active Scope, Deferrals & Design Evidence Tracker

**Updated:** 2026-10-26  
**Target market:** United States | **Minimum age:** 18+ | **Primary currency:** USD  
**Status:** Canonical tracker is `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md` (backend-only scope; Task 005). This file retains the full §4 policy text for reference.

**Team boundary:** Backend development only in this repository. Flutter is a separate repo — API contracts only, no mobile implementation here.

## 1. Source-of-truth & operating rules

1. **Build the Figma-described backend for each flow.** For each vertical slice: design-screen evidence → flow and acceptance criteria → schema/policies → routes → tests → API handoff for the external Flutter developer.
2. Existing approved product decisions, architecture decisions, and source code take precedence over assumptions in this tracker. Flag conflicts; do not silently overwrite approvals.
3. The repository and executed tests establish implementation status. **Reports are evidence summaries, not a substitute for inspecting source.** Never call proposed APIs LIVE.
4. Verify actual design sources. Earlier Figma screens were reported from exported PDFs; references labelled `PRIOR-EXPORT-REPORTED` are **not** equivalent to re-inspected screens. If a specific workflow/interaction or screen is unclear, request the exact Figma screen(s)/flow from the product owner before inventing UI or business behavior.
5. When adding/changing any API, synchronize `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`, relevant OpenAPI, tests, and `docs/plans/STATUS.md`.
6. Keep this tracker short and update it **within each feature task**, not as a separate documentation milestone. Each update must say what is implemented, what is next, what is deferred, why, dependencies, and evidence.
7. Do not commit, push, deploy, change production, or change approved rules without explicit authorization.

## 2. Current implementation — reported baseline

**Git checkpoint:** `7a56cc8` (Phase 1 authentication/stabilization). Later KYC decision documentation was reported **uncommitted** as of Task 002B.3A3; inspect current Git state before any commit.

| Feature | Status | Important qualification |
|---|---|---|
| Express/TypeScript/Prisma foundation, health and local dev/test DB setup | REPORTED IMPLEMENTED | Prisma Dev/PGlite-backed integration DB; native PostgreSQL concurrency tests remain outstanding. |
| Email/password register and login, JWT sessions, rotation/logout | REPORTED IMPLEMENTED | Auth security and session behavior partially covered by integration tests. |
| Email verification and password reset | REPORTED IMPLEMENTED — DEV EMAIL ONLY | Production ESP delivery must be integrated before real launch. |
| `/v1/me/account`, `/v1/me/profile` GET + narrow PATCH | REPORTED IMPLEMENTED | Restricted PATCH allowlist; full Figma onboarding/profile journey not yet implemented. |
| KYC policies, architecture, vendor/lifecycle options | DOCUMENTED | **No KYC routes/provider, no real KYC approval.** |
| Other product functionality below | NOT IMPLEMENTED / NOT VERIFIED | Inspect repository before updating status. |

**Latest reported validation for Task 002B.2A:** 26 unit tests passed; 21 integration tests passed and 1 skipped; lint, typecheck and build passed. This is not a fresh execution in this file.

## 3. Active next development scope — Figma-first vertical slices (backend repo)

| Order | Slice | Current intent | Design evidence/next action |
|---|---|---|---|
| NOW | Task 005 — profile & settings hub backend gaps | Safe `/v1/me/profile` PATCH fields are LIVE (Task 003). Extend backend only for **owner-approved** Figma gaps (`Screen 26`, BLOCKED `Body-1` fields). | `FIGMA_PROFILE_PARITY_MATRIX_2026-10-26.md`; Task 005 task file. Task 004 Flutter slice **cancelled** here. |
| NEXT | Post-auth profile fields (blocked) | Username, visibility, interests, favorites, location, avatar — schema/API after D-03/D-04 and related owner decisions. | Owner checklist; no implementation without authorization. |
| NEXT | Dashboard + people discovery + social connections | User-centric discovery and profile interactions actually shown in design. | Validate detailed Figma actions and privacy/visibility rules first. |
| LATER | Feed/posts/reactions/comments/stories | Follow evidenced interaction and moderation states. | Validate design and security rules per slice. |
| LATER | Groups, activities, meetup invitations | Browsing, scheduling, waitlists, RSVP and hosting; build approved gates without bypassing KYC. | Approved KYC action matrix applies; protected real-world action cannot become operational without actual verification. |
| LATER | Messaging + notifications | Messaging and delivery/status semantics based on UX. | Confirm relationships/eligibility and notification requirements. |
| LATER | Marketplace + jobs | Core listing/search interactions before financial transactions. | Review Figma details and trust/marketplace requirements. |
| LATER | Membership plans + billing | Plan/entitlement contracts without fictional paid status. | US business/processor setup and subscription rules required before activation. |

**Important:** This is proposed sequencing, not proof of what Figma contains. Change order based on verified screen dependencies.

## 4. Approved product and trust decisions — preserve

- **D-01:** USA-focused first launch; adults 18+; development location (Bangladesh) does not imply automatic user geo-blocking.
- **D-02:** Email, password, DOB, legal consent on signup; verify email before full access; no fictional proof of age from self-reported DOB.
- **D-02-AUTH:** Email/password first. OAuth/phone OTP deferred.
- **D-09:** Email verification, age eligibility and Government ID verification are separate trust dimensions.
- **KYC-01 (approved):** Government ID verification required before **real-world** meetup/activity participation and hosting; not inherently required for signup/login/browsing/account access.
- **KYC-03 (approved):** Only trusted provider server-validated decision may approve identity; no client approval or initial manual approval.
- **KYC-05 (approved):** ID, selfie and biometric evidence remains provider-hosted; backend retains only minimal approved metadata; exact field list and retention still open.
- **KYC-ENF-01..05 (approved):** In-person/hybrid confirmed join and RSVP acceptance KYC-gated; recheck at check-in; host publishing/activation gated; waitlist entry allowed but promotion gated; sender gated for real-world invites; 100% virtual-only exemption; expired/revoked status blocks new actions and restricts upcoming events without silent cancellation; provider-only approval and data minimization preserved. See owner decision record for exact wording.

## 5. Deferred vs launch-blocking — DO NOT CONFUSE

| Item | Current handling | Required before |
|---|---|---|
| Stripe/US subscription payments | DEFER implementation. Build neutral contracts if needed; no paid status without verified payment. | Enabling real billing and paid membership/marketplace payments. |
| Government ID verification provider (KYC-02) | DEFER vendor selection and integration while working on safe, non-KYC product flows. | Enabling KYC-gated real-world joins/RSVPs/hosting/invites/check-in. No fake `APPROVED` or bypass. |
| KYC-04 lifecycle, KYC-07 Flutter copy, enforcement operational details | DECISION OPEN. Preserve approved high-level rules; do not invent retries/revocation resolution. | Production KYC flows, state-transition implementation, and restricted activity operations. |
| KYC evidence retention, cross-border/privacy review | LEGAL/PRIVACY GATE OPEN. Minimize stored information, don't guess retention periods. | Processing actual identity/biometric evidence or launching jurisdiction-sensitive flows. |
| Production email provider | DEFER during feature development; dev email stub only. | Real signup verification/password recovery delivery. |
| Consent document IDs and legal versions | RELEASE BLOCKER. Do not treat arbitrary client version strings as counsel-approved. | Public release/production legal consent enforcement. |
| Distributed rate limiting, abuse controls, JWT `iss`/`aud` validation plan | SECURITY/OPS HARDENING OPEN. | Production/multi-replica scale. |
| Native PostgreSQL concurrency suite | VERIFICATION GATE OPEN; Prisma Dev/PGlite tests insufficient. | Production confidence for race-sensitive flows. |
| Phone OTP and Apple/Google sign-in | DEFER until approved. | Feature release if product requires them. |

## 6. Figma evidence and questions protocol

**Known earlier report:** a ZIP contained ~39 UI screens and ~10 other assets/auxiliary exports; the exact set and screen mapping must be **reverified** against current source files. Earlier notes referenced onboarding/auth screen IDs and KYC #34/#48/#49; treat as `PRIOR-EXPORT-REPORTED` unless reopened.

For each implementation slice, maintain a small trace: `source file / frame or screen ID | action / state | backend effect | verified vs inferred | unresolved question`.

Ask the owner for **specific** screenshots/Figma frame exports or a short walkthrough when:
- a required screen is missing/inaccessible;
- the order of screens or button/navigation behavior is ambiguous;
- an action involves sensitive permission, consent, payments, identity verification or user visibility;
- an unanswered question materially changes schema, authorization, or API shape.

Ask for the smallest relevant group of screens, not the entire Figma again unless truly necessary. State precisely which screen/flow and which missing behavior must be resolved. Until clarified, implement the unaffected verified parts and flag the blocked part.

## 7. Completion log template (append one short entry per feature task)

- **Task/date:**
- **Figma source(s) rechecked:**
- **Implemented / verified:**
- **API changes + Flutter handoff:**
- **Tests actually run:**
- **Deferred / reason / release dependency:**
- **Next Figma screens needed (if any):**
- **Git checkpoint / outstanding changes:**

