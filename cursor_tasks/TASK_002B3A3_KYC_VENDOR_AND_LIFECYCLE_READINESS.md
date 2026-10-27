# StrangeUp — Task 002B.3A3: KYC Vendor & Lifecycle Readiness Gate

**Task classification:** Documentation / due diligence ONLY. No application changes.
**Owner-approved policy baseline:** KYC-01, KYC-03, KYC-05, KYC-ENF-01..05, all approved 2026-10-26.
**Current Git checkpoint (reported):** `7a56cc8`, with subsequent KYC documentation uncommitted.
**Launch context:** USA-first consumer mobile product; engineering from Bangladesh.
**Prerequisite:** Read repository contents and do not assume this task spec supersedes later owner decisions.

## Goal

Turn the remaining KYC decision risks into concrete, evidence-linked owner choices **before** building verification session tables, provider adapter, webhooks, or live UI contracts. Do not overengineer or assume selecting a vendor is already authorized.

## 1. Inspect first (no writes to source or schema)

Read `AGENTS.md`, `.cursor/rules/`, `docs/plans/STATUS.md`, `docs/product/KYC_OWNER_DECISIONS_002B3A2.md`, `KYC_REQUIREMENTS_DECISION_GATE.md`, `OPEN_QUESTIONS.md`, `VERIFICATION_INTEGRATION_DESIGN.md`, `KYC_DATA_HANDLING_AND_THREATS.md`, `DATA_CLASSIFICATION_AND_RETENTION.md`, `PERMISSIONS_MATRIX.md`, `KYC_ACCEPTANCE_MATRIX.md`, `KYC_API_CANDIDATES.md`, `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md`, and relevant actual policies (`account-policy.ts`) read-only. Inspect `git status` and current branches.

Evidence levels: **OWNER-APPROVED**, **SOURCE-VERIFIED**, **VENDOR-DOCUMENTED**, **PROPOSED**, and **UNRESOLVED**. Earlier screenshots are PRIOR-EXPORT-REPORTED unless re-opened.

## 2. Vendor research — KYC-02 (no selection)

Compare **Stripe Identity, Persona, and Veriff** using current official product, developer, data-handling, pricing and contractual documentation. Relevant starting points:
- Stripe Identity: https://stripe.com/identity
- Persona Hosted Flow: https://docs.withpersona.com/hosted-flow
- Persona Webhooks: https://docs.withpersona.com/webhooks
- Veriff Document + Selfie IDV: https://devdocs.veriff.com/v1/docs/document-selfie-idv
- Veriff Webhooks: https://devdocs.veriff.com/docs/webhooks-guide

Check per provider: government ID + selfie/liveness, US document coverage, server-created session, Flutter-compatible user flow (hosted URL or supported mobile SDK; verify exact integration), signed webhooks and replay protection, sandbox/test mode, final-decision and expiration/revocation semantics, data retention/deletion controls, PII minimization and redacted webhook parsing, access restrictions for Bangladesh-based operators, DPA/subprocessors, support for appeals/retries and manual-review **by provider** (NOT StrangeUp manual approval), pricing/volume/minimum commitment, and availability to StrangeUp's actual legal entity. Mark **NOT VERIFIED** instead of guessing. Separate vendor claims from integration decisions. Do not request credentials yet.

Create `docs/product/KYC_VENDOR_EVALUATION.md` with a compact evidence matrix, URLs and accessed dates, proposed shortlist (not a selection), pricing and privacy unknowns, owner-selection questions, and conditional recommendation based on product priorities.

## 3. KYC-04 lifecycle: decisions required before code

Create `docs/product/KYC_LIFECYCLE_DECISION_OPTIONS.md`, distinguishing:
- **Session state** (provider workflow attempt): e.g. CREATED / STARTED / IN_REVIEW / APPROVED / REJECTED / EXPIRED / CANCELLED (examples only; vendor-dependent).
- **User identity trust state** (current eligibility): NOT_STARTED / PENDING / APPROVED / REJECTED / EXPIRED / REVOKED as candidates — reconcile names against actual current Prisma schema; do not silently add enum values.
- Only authenticated, validated provider outcome may yield `APPROVED` (KYC-03); no local client/manual approval or test bypass.
- One active session or controlled multiple attempts, retry limits/cooldowns, abandoned sessions, appeals (provider-managed or support referral), re-verification triggers, outages, webhook delivery failures, duplicated/out-of-order callbacks, stale prior sessions and expiry/revocation source.
- Specific non-destructive handling of existing future bookings and hosted events after expiry/revocation: restriction pending notification/resolution; detailed grace period, seat handling and host replacement remain owner decisions.
- Sensitive action checks at join confirmation, waitlist promotion, invite send / RSVP accept, publish/activate and check-in. 100% virtual exemption; hybrid/in-person gated; what happens on virtual-to-hybrid reclassification remains unresolved.

Give recommended **proposals** and consequences; create a short owner sign-off checklist. Do not mark unapproved KYC-04 decisions resolved.

## 4. KYC-05 specifics + KYC-06 privacy review handoff

Propose a **minimal metadata field allowlist**: internal user ID, internal session ID, opaque vendor ID/reference, normalized state, safe decision code, timestamps, provider event deduplication ID, audit actor/source. Evaluate each field for necessity; do not assume all are approved. No raw ID number/image, selfie, biometric template, sensitive URL, raw unfiltered webhook, secrets or token in DB, logs or analytics.

Create `docs/security/KYC_PRIVACY_VENDOR_CHECKLIST.md` specifying the exact counsel/vendor questions, not asserting legal compliance. Explicitly address USA end-user data, Bangladesh developer access, biometrics notice/consent, data retention and deletion, vendor subprocessors, export/delete APIs and breach incident handling. Do not propose a definitive retention number absent approval.

## 5. Flutter/API consistency

Keep `docs/api/CURRENT_APIS.md` LIVE rows unchanged. Keep KYC endpoints NOT IMPLEMENTED in `KYC_API_CANDIDATES.md`. Update `FLUTTER_DEVELOPER_HANDOFF.md` **only if** useful to identify remaining integration dependencies; no fabricated active SDK flow, response schema, approval badge, or completed UI states. Define pending Flutter responsibilities: hosted flow/deep link, verification status polling and denial UX, user-cancel/error handling, accessible remediation messaging. UX copy KYC-07 remains open.

## 6. Git handling

Inspect existing uncommitted documentation. Do not commit, push, rebase, reset, stage everything, move files unexpectedly, or overwrite earlier approved records. Propose a clean documentation-only Git checkpoint, and ask the owner to authorize it separately. Verify `.env` and other secrets stay out of tracked files.

## 7. Completion report

Report: document paths created/updated; official source references and open vendor questions; KYC-02/04/05-metadata/06/07 and operations decision statuses; explicit differences between current/live and planned contracts; Git status; and a **minimum Task 002B.3B entry gate**. State no implementation/testing occurred unless verified. Keep remaining choices for owner approval clearly presented.

## Prohibited in this task

No new code, Prisma models, migration, vendor credentials, API routes, hosted links, fake APPROVED state, SDK install, staging/production change, or Git commit/push. Preserve KYC-01/03/05 and five enforcement policies exactly as approved.
