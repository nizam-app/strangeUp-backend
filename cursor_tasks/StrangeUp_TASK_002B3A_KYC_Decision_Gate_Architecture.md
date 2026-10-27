# StrangeUp — TASK 002B.3A: Identity Verification / KYC Decision Gate (Design Only)

**Project:** StrangeUp backend (Flutter + TypeScript / Express / Prisma / PostgreSQL)

**Owner-confirmed:** USA-first launch, developed from Bangladesh; adults only (18+); Phase 1 email/password; separate email-verification, declared-age eligibility and government identity verification; NO live KYC provider yet (ADR-004).

**Type:** Architectural analysis and decision documentation ONLY. No new API routes, source-code modules, Prisma models, migrations, packages, remote services, deployments, Git commits or pushes. **Do not change Figma.**

**Preconditions:** Task 002B.2A is reported passed (26 unit tests, 21 real integration tests, one documented skip; separate named Prisma Dev instances). Inspect actual repository and Git state first; verify any prerequisite checkpoint is recorded before proceeding. If no approved Git commit has occurred, do not commit merely because of this document.

## Purpose

We need to preserve a safe identity-verification architecture without faking completion or asserting a verification status based on an untrusted Flutter client. Separate *authenticated*, *email-verified*, *age-declared eligible*, *identity verified*, and *permitted to interact* throughout the design. Never implement a fake KYC session simply to make the UI appear complete. Do not treat self-reported DOB as identity proof.

## Step 1 — Inspect source of truth and evidence

Read `AGENTS.md`, `.cursor/rules/`, `docs/plans/STATUS.md`, ADR-004, `docs/product/OPEN_QUESTIONS.md`, `docs/product/IDENTITY_DECISION_REVIEW.md`, `docs/architecture/IDENTITY_DESIGN_PROPOSAL.md`, `docs/security/SECURITY_MODEL.md`, `docs/security/PERMISSIONS_MATRIX.md`, `docs/operations/DATA_CLASSIFICATION_AND_RETENTION.md`, `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`, existing OpenAPI files and `src/modules/auth`, `src/modules/me` and policy code.

Review verified export references for ID upload, selfie and identity verification from `SCREEN_TRACEABILITY.md`. If actual PDF frames are unavailable locally, label them **PRIOR-EXPORT-REPORTED**, not independently verified; never infer on-screen interactions not documented by evidence. Check for inconsistencies with approved D-01, D-02, D-02-AUTH and D-09.

## Step 2 — Draft product decision register (DO NOT approve on owner's behalf)

Document at least these open decisions in `docs/product/KYC_REQUIREMENTS_DECISION_GATE.md` and reconcile with `OPEN_QUESTIONS.md`:

- **KYC gating:** Is government ID required for all accounts at signup, before social interaction, only before hosting/meetups, or for specific higher-risk actions? Do not infer this from the presence of a verification screen.
- **Provider:** Managed government-ID + liveness vendor versus alternative; none selected. Evaluate provider support for US, data residency, privacy, cost, SDK support, identity verification vs age assurance, and webhook reliability when choosing later.
- **Assurance & failure states:** Does `VERIFIED` mean approved by vendor, manually reviewed, or some other level? Define which actor can change state and required evidence. No client-controlled verification success.
- **Retry/review:** Retry after document failure, rejection appeals, verification expiration/revocation, duplicate attempts, suspended/deleted accounts, and support interventions.
- **Privacy/data:** Whether backend can store provider reference, status, timestamps, verification level and minimal audit metadata; whether government ID images/selfies/biometrics should remain exclusively with provider. Define retention, deletion and access policies through an appropriate legal/privacy review.
- **USA rollout:** Federal/state-specific product/legal implications require review; do not invent compliance claims, blanket USA geofencing or an automatic legal requirement for universal ID verification.
- **Flutter UX:** What to display for NOT_STARTED, PENDING, IN_REVIEW, VERIFIED, REJECTED, EXPIRED, REVOKED, unavailable provider, and account ineligible. Treat these as candidate states pending approval.

Tag each statement: **CONFIRMED / PRIOR-EXPORT-REPORTED / DESIGN-INFERRED / PROPOSED / UNRESOLVED**.

## Step 3 — Proposed, provider-neutral architecture (documentation only)

Draft `docs/architecture/VERIFICATION_INTEGRATION_DESIGN.md` covering:

1. Domain boundary: User identity, email verification and self-declared age remain separate from optional vendor KYC verification.
2. Proposed provider adapter interface and its failure contract; no vendor integration or credentials now.
3. Proposed (not implemented) state machine, transition authority, idempotency, optimistic concurrency and out-of-order webhook handling.
4. Draft session initiation, status polling, expiry, retry and cancellation workflows, with what Flutter receives (opaque session/reference where appropriate, never secret API keys).
5. Server-to-server webhook validation, replay/idempotency, provider event authentication, bounded retries and audit trail. Never trust a mobile callback to declare success.
6. Cross-module policy implications (profile visibility, discovery, messaging, hosting, meetups, marketplace and group participation) without selecting unapproved gates.
7. Compliance/privacy considerations, data minimization, redaction, abuse prevention and operational failure modes.
8. Provider selection/evaluation checklist, approximate integration phases and rollback/deactivation strategy.

Draft `docs/security/KYC_DATA_HANDLING_AND_THREATS.md` with data classification and a threat model. Prefer provider-hosted document/selfie storage and minimal backend metadata *as a proposal*, subject to provider/legal choices. Avoid guessing retention periods or asserting encryption guarantees.

## Step 4 — API proposals and Flutter contract (NO LIVE APIs)

Draft `docs/api/KYC_API_CANDIDATES.md` with candidate method/path, actor, preconditions, request/response sketches, error codes and trust boundaries for initiation and status. Include webhook candidate separately as **PROPOSED** and annotate required provider decision. Do not treat `/v1/me/verification/sessions` or a status route as LIVE/DEV_ONLY unless actually implemented and tested.

Audit `docs/api/CURRENT_APIS.md` without adding any KYC route to LIVE. In `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`, optional small **PLANNED/UNAPPROVED** note is allowed, clearly warning the Flutter developer that no KYC endpoint or vendor session exists yet. Preserve existing working API documentation. No invented endpoint payload should be represented as an active contract.

## Step 5 — Acceptance test design

Create `docs/testing/KYC_ACCEPTANCE_MATRIX.md` proposing positive, negative and concurrency cases for:

- Underage/ineligible account, pending email verification, suspended/deleted users.
- User A viewing/changing User B's KYC state (BOLA), client-forged VERIFIED status.
- Replayed, unsigned, malformed, late and out-of-order webhooks; forged vendor event IDs.
- Duplicate initiation, provider timeout, SDK cancel, webhook delay or disconnect, retry/appeal behavior.
- Expiry, revoke, account deletion and retention/deletion requests.
- No ID/selfie payloads, tokens or provider credentials in logs or unrestricted DTOs.
- Native PostgreSQL transaction/concurrency checks after a real provider contract is approved.

Every test should name a feature decision dependency; do not claim executed tests for design-only tasks.

## Step 6 — Implementation sequencing and decision gate

Update `docs/plans/STATUS.md` with Task 002B.3A **DESIGN DRAFTED — DECISION APPROVAL PENDING**. Propose 002B.3B only after the owner decides minimum KYC gates, session lifecycle, provider plan and retention strategy. If the provider remains unselected, recommend keeping active KYC APIs **unimplemented** rather than producing misleading mock success. Note which adjacent, already-approved profile/auth documentation can continue without KYC decisions.

## Completion report

Report: (a) actual files read and evidence level; (b) created/updated docs; (c) unresolved owner decisions with recommendation and impact; (d) proposed API **not-live** inventory; (e) security/compliance blockers; (f) Git status; (g) scope for next task. State clearly: **No KYC feature implemented; no vendor integrated; no migration; no LIVE APIs added**.

## Constraints

- No modifications to application code, `prisma/schema.prisma`, migration files or original Figma.
- No emails, SMS, payment or identity-vendor calls; do not collect/store real ID imagery or biometric material.
- No Git commits/pushes without explicit product-owner approval.
- Do not convert the USA launch context or 18+ product baseline into a blanket verified legal conclusion.
- Do not fabricate Figma screens or vendor capabilities.
