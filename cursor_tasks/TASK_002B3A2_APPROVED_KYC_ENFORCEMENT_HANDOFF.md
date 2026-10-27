# Cursor Task 002B.3A2 — Record Approved KYC Authority, Storage and Action Gates

**Project:** StrangeUp backend — Node.js / TypeScript / Express / Prisma / PostgreSQL  
**Task type:** DOCUMENTATION ONLY — do not implement or deploy  
**Owner approvals:** KYC-01 Option A (previously approved), **KYC-03**, **KYC-05**, and the **five concrete enforcement policies** explicitly approved on **2026-10-26**.  
**Expected starting point:** Git checkpoint `7a56cc8` plus uncommitted KYC architecture/decision docs from Tasks 002B.3A and 002B.3A1. Do not assume `HEAD` is still that hash: inspect actual repository state first.

## 0. Absolute constraints

- **Do not** modify `src/`, `prisma/schema.prisma`, migrations, `.env`, runtime configuration, dependencies, tests, infrastructure, Figma files or production/staging services.
- **Do not** create or activate KYC APIs, webhooks, stubbed APPROVED flows, mock provider responses, new Prisma entities, feature flags, or UI source code.
- **Do not** select a KYC vendor, make provider commitments, start a sandbox, run migrations, create commits, rewrite git history or push without separate explicit authorization.
- Never mark a KYC endpoint `LIVE`/`DEV_ONLY` or claim KYC enforcement exists because the policy is approved.
- This task authorizes **documentation updates only**, preserving source evidence and prior unrelated working-tree changes.

## 1. Preflight and source-of-truth inspection

1. Run `git status --short`, `git log -1 --oneline`, `git diff --stat`, and inspect relevant tracked/untracked documentation. Take note of the uncommitted 002B.3A / 002B.3A1 work. Do not delete or overwrite it.
2. Read `AGENTS.md`, `.cursor/rules/`, `docs/plans/STATUS.md`, and identity ADRs (including `docs/decisions/ADR-004-identity-phase1-owner-decisions.md`).
3. Read these exact files where available (locate counterparts if moved):
   - `docs/product/KYC_REQUIREMENTS_DECISION_GATE.md`
   - `docs/product/KYC_OWNER_DECISIONS_002B3A1.md`
   - `docs/product/KYC_OWNER_DECISIONS_002B3A2.md` (provided with this task)
   - `docs/product/OPEN_QUESTIONS.md`
   - `docs/architecture/VERIFICATION_INTEGRATION_DESIGN.md`
   - `docs/security/KYC_DATA_HANDLING_AND_THREATS.md`
   - `docs/security/PERMISSIONS_MATRIX.md`
   - `docs/testing/KYC_ACCEPTANCE_MATRIX.md`
   - `docs/api/KYC_API_CANDIDATES.md`
   - `docs/api/CURRENT_APIS.md`
   - `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`
4. Read `src/modules/policy/account-policy.ts` and existing `prisma/schema.prisma` **read-only** to see current policy enums/stubs; do not assume new KYC fields or APIs exist.
5. Preserve status labels such as `PRIOR-EXPORT-REPORTED` for Figma screen references, unless the primary export was actually reexamined. Explicit owner decisions outrank speculative UI behavior, not verified implementation evidence.
6. Note any contradictory claims in the source files and reconcile **only documentation** using the owner-approved snapshot; report code-level conflicts without modifying code.

## 2. Approved decisions to record EXACTLY (no reinterpretation)

**KYC-01** — Already approved: US-first, adults-only StrangeUp requires government-ID verification **before real-world Meetup/Activity participation and hosting**; not automatically for signup, login, browsing or own-profile actions.

**KYC-03 — NOW APPROVED:** Only a trusted provider's **server-authenticated/validated decision** can make government identity `APPROVED`; **no initial manual approval** and no client/self-DOB approval. Email verified, self-declared DOB eligibility and identity assurance are separate.

**KYC-05 — NOW APPROVED:** Identity evidence (ID images, selfie, biometrics) remains **provider-hosted**, with only minimal verified session/status/reference/timestamp/audit metadata in StrangeUp. No raw sensitive evidence stored by default. Actual metadata field list, retention duration, deletion workflow, cross-border legal review and provider DPA remain pending.

**Five owner-approved enforcement points:**

1. **Join / RSVP / check-in / hosting:** Require current valid KYC before **confirming Activity join**, before **accepting real-world Meetup RSVP**, and **recheck at check-in**; require KYC for host before **publish/activate**.
2. **Waitlist / invitations:** Unverified may join waitlist but **must not be promoted to confirmed participant** until KYC passes. **Sender** must be approved before sending a **real-world Meetup invitation**; **recipient** must pass their own participation gate before accepting.
3. **Modality:** **100% virtual-only Activity exempt** from this KYC gate; **hybrid and in-person** Activity remain KYC-gated. Other entitlement/role restrictions unaffected.
4. **Expiry / revocation:** Deny new real-world joins/hosting; temporarily restrict **existing upcoming** participation/hosting. **Do not silently delete/cancel** existing bookings/events. Document required notification plus organizer/admin resolution workflow while keeping exact remediation/timing and exceptions open.
5. **KYC-03/05 confirmed:** Record those approval and data-minimization rules, without prematurely approving provider/retention/legal status.

**Be precise:** “KYC-04” as a whole is **not** approved just because revocation's broad impact was approved. “KYC-07” as a whole is **not** approved just because Flutter should show no fake verification. KYC-02 provider, retention, vendor webhooks, detailed fallback and legal review stay OPEN.

## 3. Required documentation updates (minimal diffs)

1. `docs/product/KYC_REQUIREMENTS_DECISION_GATE.md`
   - Move **KYC-03** and **KYC-05** from `PROPOSED` to `OWNER-APPROVED (2026-10-26)` with exact approved boundaries.
   - Keep **KYC-01** approved; add its five confirmed action-level rules without duplicating or contradicting previous notes.
   - Keep KYC-02/04/06/07 as OPEN or partially bounded; clearly separate approved high-level impact from unresolved operational details.
2. `docs/product/OPEN_QUESTIONS.md`
   - Mark concrete action-gating portions of **D-09-kyc-enforcement** RESOLVED by owner; link to the new 002B.3A2 decision record.
   - Keep per-event reclassification, no-show, reactivation, timing, organizer reassignment, appeals, retries and legal/vendor/retention questions OPEN as distinct residual questions; do not declare the entire KYC domain resolved.
3. `docs/architecture/VERIFICATION_INTEGRATION_DESIGN.md`
   - Clarify trusted provider authority only, server-side policy evaluation at sensitive transitions and separation of provider session state vs aggregate user identity status.
   - Add conceptual policy matrix for join, RSVP, check-in, host publish, waitlist promotion, invitation sending, virtual-only exemption, and revocation/expiry. Preserve existing code/stub reality; do not finalize new enum/schema by assumption.
4. `docs/security/KYC_DATA_HANDLING_AND_THREATS.md` and `docs/security/PERMISSIONS_MATRIX.md`
   - Record **approved** provider-hosted evidence / minimal metadata posture and forbidden raw evidence persistence.
   - Address audit, policy enforcement, provider auth/validation and non-authoritative client statuses conceptually. Keep exact data allowlist, TTLs, encryption policy, DPA, cross-border processing and legal review OPEN.
5. `docs/testing/KYC_ACCEPTANCE_MATRIX.md`
   - Write **PLANNED / NOT EXECUTED** acceptance cases for every approved action gate, exemption, stale/revoked statuses, waitlist promotion, invite sender/recipient distinction, check-in recheck, concurrency/race and unauthorized client approval. Include negative tests and no silent cancellation.
   - Do not mark these tests PASS; no tests are being executed in this documentation-only task.
6. `docs/api/KYC_API_CANDIDATES.md`
   - Document **future** policy requirements and, if useful, candidate stable denial responses. All KYC routes must remain **PLANNED / NOT IMPLEMENTED**; candidate error codes are proposals, not LIVE API contracts.
7. `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`
   - Separate **APPROVED PRODUCT POLICY** from **API / KYC FLOW NOT LIVE**. Describe UX behavior expected after implementation: verification needed prompts for protected actions, free virtual-only paths, waitlist permitted pending approval, block/guide for expired/revoked status, never trust client-only `APPROVED`.
   - Clearly state that Flutter must not call proposed endpoints as LIVE, cannot mark the user verified and must not assume a successful document upload grants privileges.
8. `docs/api/CURRENT_APIS.md`
   - **Do not alter LIVE/DEV_ONLY route inventory.** Only update a `PLANNED / NOT IMPLEMENTED` note with approved future policy if needed; no new active KYC endpoints.
9. `docs/plans/STATUS.md`
   - Record **Task 002B.3A2 — OWNER DECISIONS DOCUMENTED**, code/DB/API untouched, explicit follow-up gate and which decisions remain open.
   - Clearly state that Task 002B.3B **has not started** and no KYC implementation is authorized by this documentation task.
10. `docs/product/KYC_OWNER_DECISIONS_002B3A2.md`
   - Preserve the provided approval record, sign-off date and scope. Link it to existing decision sources and relevant docs. Do not silently replace prior owner history.

## 4. Explicit next implementation decision gate — do NOT execute

The next engineering decision is whether to proceed with **002B.3B (provider-neutral verification foundation)** while the vendor remains unselected, and exactly which schema/status-read operations—if any—are authorized. This handoff **does not approve** 002B.3B implementation.

Before writing or activating a KYC feature, resolve at least:
- Schema/status terminology and allowed transitions, including user summary state versus session state.
- KYC-02 vendor selection path for any genuine `APPROVED` transition / launch capability; if provider unselected, do not produce fake verified behavior.
- KYC-04 details (retry, appeal, provider failure, delayed webhooks, revocation remediation).
- KYC-05 provider-specific permitted metadata and retention/deletion terms following needed reviews.
- KYC-06 US/privacy/biometric and Bangladesh engineering access review before launch; KYC-07 Flutter copy/states as relevant.
- Testing approach for provider webhook authenticity/idempotency, concurrency, real native PostgreSQL, and denial at actual feature boundaries.

Nothing here requires all these items resolved to *draft* future architecture; none may be silently approved just to start coding.

## 5. Verification and completion report

Run read-only review commands: `git status --short`, `git diff --stat`, `git diff --check`, and inspect changed doc content. Optionally check links/references and policy statuses via search/grep. No code compilation/test run is necessary because no code should change; report any checks actually performed.

Before reporting completion, verify:

- [ ] KYC-01, KYC-03, KYC-05 all explicitly marked **APPROVED** with 2026-10-26 owner evidence.
- [ ] Five approved action-level policies captured consistently with no extra invented requirements.
- [ ] KYC-02/04/06/07 and retention/vendor decisions remain OPEN where genuinely unresolved.
- [ ] Session vs identity verification and client/server trust boundaries accurately distinguished.
- [ ] **No KYC endpoints** promoted from PLANNED to LIVE/DEV_ONLY.
- [ ] Flutter handoff and KYC candidates have synchronized **NOT IMPLEMENTED** labeling.
- [ ] `src/`, Prisma schema/migrations, packages, config and runtime behavior unchanged.
- [ ] No accidental secrets/raw identity evidence introduced; no commit/push/production changes.

**Return a concise evidence-based completion report:** (a) Git pre/post state; (b) files inspected; (c) documents changed; (d) owner approval matrix; (e) final action-level policy matrix; (f) Flutter/API registry integrity; (g) outstanding implementation blockers; (h) verification commands actually run; (i) minimal next engineering recommendation. Do not begin 002B.3B.
