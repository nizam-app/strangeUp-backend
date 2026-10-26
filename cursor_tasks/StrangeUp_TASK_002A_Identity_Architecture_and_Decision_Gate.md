# STRANGEUP — CURSOR TASK 002A

**Title:** Identity, Authentication & Trust Architecture — Decision Gate (Design Only)
**Status:** READY TO EXECUTE — NO BUSINESS SCHEMA CHANGES
**Predecessors:** TASK_001_BACKEND_FOUNDATION.md and Task 001.1 (local database and Git baseline)
**Repository:** `D:\TONMOY-TR\strangeUp\strangeup-backend`
**Implementation phase:** M1.1 — identity specification, before first business migration

## Objective

Convert the verified StrangeUp UI export findings and existing Phase 0.2 engineering documents into a precise, reviewable **identity/authentication/verification specification**. Provide an implementation-ready plan for Task 002B, without implementing business tables, endpoints or provider integrations until product-critical decisions are approved.

User-facing Figma file must remain unchanged. The repository already has an Express/TypeScript/Prisma 7 PostgreSQL foundation with local Git, unit testing, and one live PGlite-backed integration connectivity test reported as passing. Treat those as **Cursor-reported**, inspect actual repository before relying on them. `prisma dev` is not equivalent to a full native PostgreSQL concurrency test environment.

## Absolute restrictions

- Do not edit the Figma file, initiate any production/cloud/database operation, or ask for Figma edit access.
- Do not add Prisma `User`, `Session`, `Verification`, or other business models in this task. Do not create migrations, alter databases, or build auth routes/services.
- Do not install new packages or switch framework/ORM/runtime versions.
- Do not invent eligibility, identity/KYC, messaging-contact, location or premium access product rules. Where not approved, label `PROPOSED` or `UNRESOLVED` and default to **not enabled** for future privileged operations.
- Never make a user `verified`, grant subscription entitlements, merge OAuth identities, or mark ID/selfie verification as successful based solely on client-submitted data.
- Do not copy, log, commit, or paste `.env` values, secrets, personal identifiers, or hosted database URLs.
- Update existing documentation only with minimal, traceable changes; preserve working application code and current `git` history. Do not create a Git remote or push.

## Step 1 — Inspect the existing source of truth

Read these, where available:

- `AGENTS.md` and `.cursor/rules/engineering.mdc`
- `README.md`, `package.json`, `prisma/schema.prisma`, `src/app.ts`, `src/server.ts`, `src/config/env.ts`, `src/infrastructure/database/prisma.ts`
- `docs/product/PRD_DRAFT.md`, `FEATURE_MATRIX.md`, `SCREEN_TRACEABILITY.md`, `USER_FLOWS.md`, `BUSINESS_RULES.md`, `OPEN_QUESTIONS.md`
- `docs/architecture/SYSTEM.md`, `MODULES.md`
- `docs/database/DATA_MODEL.md`, `docs/security/SECURITY_MODEL.md`, `PERMISSIONS_MATRIX.md`
- `docs/api/CONVENTIONS.md`, `ENDPOINT_CANDIDATES.md`
- `docs/plans/STATUS.md` and Task 001.1 handoff/results, if saved.

Check the actual working tree (`git status --short`) before doing anything. Confirm that `prisma/schema.prisma` still contains no business models and the previous baseline is intact. If any listed documentation is missing, report which file(s) could not be read. Inspect source references, not just feature names.

## Step 2 — Evidence mapping from exported design

Build a compact identity-focused screen-to-requirement mapping. Prior observations documented in Phase 0.2:

- Export **31**: Login, including email/password and Apple/Google UI options.
- Export **33**: Signup fields including name, email, phone, password.
- Exports **34, 48, 49**: Government ID, selfie/liveness and multi-step verification UI.
- Export **35**: Password-recovery/verification-related flow; inspect source traceability for its exact purpose; do not guess.
- Export **37**: Profile edits, DOB and visibility-related information.
- Export **25**: Settings, privacy/security and account lifecycle.

A screen's UI representation is **DESIGN-OBSERVED**, not approval of underlying auth rules, age eligibility, biometric verification vendor, or exact states. If ZIP/PDF sources are not present locally, cite `SCREEN_TRACEABILITY.md` and mark findings `PRIOR-EXPORT-REPORTED`, not direct inspection.

## Step 3 — Owner decision gate

Produce a decision table using the current D-IDs, preserving earlier approved answers if any. Clearly separate baseline engineering requirements from owner decisions.

**Blocking for first identity implementation:**

- **D-01:** Initial launch region/jurisdictions and minimum age. Recommend adults-only *as a proposal*, with no region-specific legal claim unless verified.
- **D-02:** Signup data collection (including DOB and acceptance records); email/phone verification gates; whether registration creates `PENDING` access and what capabilities remain disabled pending verification.
- **D-09:** The boundary between `email/phone verified`, `age-eligible`, and `identity/KYC verified`; provider selection or intentionally deferred provider integration, liveness verdict policy, appeals and sensitive data retention.
- **Auth method decision (new subdecision, link to D-02):** Which Phase 1 auth methods are in scope: email/password, Google Sign-In, Apple Sign-In, phone OTP; whether email and phone are both required and unique; device/session rules.

**Relevant but not blocking for a private non-discovery auth skeleton:**

- **D-03:** Who may contact/wave/follow whom. Leave interaction endpoints disabled until resolved.
- **D-04:** Discovery location exposure/privacy. Do not store/expose precise location by default.
- **D-10:** Actual E2EE claim. Do not promise E2EE absent a proven design; not an Auth Phase 1 deliverable.

For each decision: capture options, one justified recommendation, affected modules, user-experience impact, security/privacy risk, rollout consequence, and explicit status (`OPEN` or `APPROVED`). Do not mark anything approved without owner confirmation.

## Step 4 — Design identity domain boundaries (proposal only)

Specify candidate aggregates, their responsibilities and lifecycle, without writing Prisma schema yet:

1. `User` / account status: actor identity, onboarding state, suspension/deletion lifecycle.
2. `PasswordCredential`: password hash and credential lifecycle; no plaintext credentials.
3. `ExternalIdentity`: OAuth provider, immutable provider subject, secure linking/unlinking; never blindly merge on matching email.
4. `Session` / refresh token family: rotation, revocation, expiry, replay controls, lost-device logout.
5. `AuthChallenge` / verification challenge: hashed expiring secrets, retry limits, email verification, reset and/or OTP if approved.
6. `Profile`: public/private profile separation, editable attributes, DOB access policy.
7. `ConsentRecord`: versioned terms/privacy/age consent where needed by product decision.
8. `IdentityVerificationSession` and `VerificationDecision`: provider-neutral reference/status/decision provenance without default storage of raw ID/selfie artifacts.
9. `UserBlock` and essential moderation gate: future cross-module authorization dependency, no social implementation yet.

Propose primary keys, unique indexes, relation cardinality, retention classifications, cascade/delete safeguards, timestamps, audit needs, and state-transition invariants. Distinguish authentication, eligibility, KYC, moderation, and subscription entitlements as **different concepts**. A single `isVerified` boolean must not combine them.

Consider asynchronous provider webhooks, duplicate/replayed events, stale identities, concurrent registration, duplicate email, password reset token reuse, account deletion, suspended sessions, and privacy-preserving public profile DTOs.

## Step 5 — Draft API and authorization contracts (no implementation)

Provide candidate versioned REST API endpoints only where justified by observed design / approved scope. Examples for review: registration, login, refresh, logout, logout-all, account overview, profile GET/PATCH, password reset request/confirm, email verification and KYC session initiation/status. DO NOT assume all will be in Task 002B.

For each endpoint, define request schema, response envelope (using existing conventions), error codes, authentication, resource ownership, enumeration prevention, rate limiting, idempotency where appropriate, and negative tests. API clients must not infer verified identity or paid access from optimistic client UI.

Propose centralized policy entry points for `canAccessAccount`, `canEditProfile`, `canStartVerification`, `canAccessOwnVerificationStatus`, and a future `canInteractWithUser` (left disabled until D-03). Provide default-deny handling for unapproved product entitlements. No premature global role enums for per-group or per-activity ownership.

## Step 6 — Testing and deployment gates

Draft tests for: duplicate signup requests, malformed credentials, enumeration-resistant reset, expired/reused challenges, concurrent refresh/replay, logout token revocation, email change/ownership, OAuth identity collision, suspended/deleted users, attempts to view another user's private profile or verification status, KYC webhook replay, forbidden unverified privileges, and secret/PII log redaction.

Specify test layers (unit, API, PostgreSQL integration, security/BOLA), prerequisites and deterministic acceptance criteria. Plan to run **native PostgreSQL** integration/concurrency tests before declaring advanced locking behavior verified; local PGlite-backed connectivity tests alone are not sufficient evidence for those scenarios. Do not introduce real KYC credentials/providers or test with real identity documents.

## Step 7 — Produce minimal reviewable documentation

Prefer updating existing docs rather than creating redundant sources. If absent, create only these scoped drafts:

- `docs/product/IDENTITY_DECISION_REVIEW.md` — D-01/D-02/D-09 + auth-method decision, explicit OPEN/APPROVED status.
- `docs/architecture/IDENTITY_DESIGN_PROPOSAL.md` — aggregate boundaries, lifecycle/state machines, dependencies, and decision-conditioned options.
- `docs/api/IDENTITY_API_DRAFT.md` — contracts and policy/authorization matrix linked to existing conventions.
- `docs/testing/IDENTITY_ACCEPTANCE_MATRIX.md` — positive, negative, concurrency and security cases.

Update `docs/plans/STATUS.md` marking **Task 002A design drafted, owner approval pending**, never "implemented" or "tested" for auth functionality. Update open decisions only if adding a missing question; do not silently approve them.

## Acceptance criteria

- Source docs and implementation baseline inspected, with evidence and unchanged application code.
- Each identity-critical requirement labeled CONFIRMED, DESIGN-OBSERVED, PROPOSED or UNRESOLVED.
- D-01, D-02, D-09 and auth-method choice have explicit options and owner sign-off gates.
- Candidate entities, identity/trust state machines, API contracts, resource ACL, and threat model are documented consistently.
- No Prisma business models, migrations, route implementations, provider setup, package installation, destructive operation or remote push.
- Git working tree changes are limited to intended documentation; credentials remain absent from tracked files.
- The result contains an **exact, proposed Task 002B implementation scope** conditional on approved decisions, with no made-up sign-offs.

## Final report to ChatGPT/user

Summarize: files inspected; sources/evidence IDs; documents created/modified; precise unresolved decisions; proposed default and risks for each; preliminary entities/contracts/policies; safeguards/test requirements; `git status --short`; any checks performed; explicit statement that **no auth code/database migration was executed**; and the next owner decisions required before Task 002B.
