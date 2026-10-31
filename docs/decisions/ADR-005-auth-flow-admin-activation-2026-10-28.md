# ADR-005: Mandatory IDV + StrangeUp admin activation before Home (2026-10-28)

## Status

**Accepted** — supersedes browse-before-government-ID assumptions in KYC-01 and provider-only full activation in KYC-03 for **main product / Home access**.

## Context

Product owner confirmed (2026-10-28):

`Create Account → Government ID → Selfie → Veriff decision → StrangeUp admin review → Home access`.

Provider identity verification remains the **only** authority for document/selfie outcomes. StrangeUp admin **activation** is an additional platform gate. Admin approval cannot override provider decline, expiry, revocation, or missing legal/age/email prerequisites.

## Decision

1. Model **orthogonal** state: account/email/age/consent, provider `identityVerificationStatus`, `StrangeUpAdminReviewStatus`, and computed effective application access.
2. **`hasFullAccountAccess` / Home** requires: active eligible account, verified email, trusted provider KYC for the **current** session, and admin `APPROVED` tied to the **same** `identityVerificationSessionId`.
3. Pending applicants may authenticate for **onboarding-safe** APIs (status, verification sessions, email/password, consent reads) without main-app authority.
4. Provider `APPROVED` transitions admin review to `PENDING` (queue-ready); it does **not** grant Home.

## Consequences

- Legacy users with email-verified `ACTIVE` accounts lose effective Home access until admin approval (forward-only; no fake backfill).
- Flutter must use `GET /v1/me/onboarding/status` and must not treat SDK completion or provider approval as final activation.
- Phase 022B implements admin review APIs (`PlatformStaffGrant` + `/v1/admin/identity-reviews/*`); Phase 022C enforces deny codes across main-app routers with DB-backed middleware; Phase 022D documents Figma parity and bounded auth E2E tests (`docs/product/FIGMA_AUTH_FLOW_PARITY_TASK022.md`, `docs/plans/TASK_022D_AUTH_FLOW_ACCEPTANCE_REPORT.md`).

## References

- `cursor_tasks/StrangeUp_TASK_022_Auth_Onboarding_Admin_Approval_Flow_Repair.md`
- `cursor_tasks/StrangeUp_Task_022_Staged_Auth_Repair_Execution.md`

---

## Amendment (2026-10-30 — Task 031B.2)

**Supersedes** the verified-email prerequisite for Home/onboarding/IDV/admin approve only. See **`ADR-005-amendment-2026-10-30-email-optional-onboarding.md`**. Trusted KYC + admin activation on the same session remain mandatory.
