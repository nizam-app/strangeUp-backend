# StrangeUp — Task 022: Figma Auth Flow Repair — Mandatory IDV + Admin-Approved Activation

**Owner-approved new product rule (2026-10-28):** `Create Account → Government ID → Selfie → Provider Verification Result → StrangeUp Admin Review → Home access`. No user may access Home or the main product until final StrangeUp admin approval and all independent security prerequisites pass.

**Mode:** IMPLEMENT and VERIFY, backend only. Node.js / TypeScript / Express / Prisma / Neon PostgreSQL. No Flutter repository, no admin frontend UI. Use actual current repository code and Figma `Strange up(auth).zip`; do not guess existing route names. No commits, pushes, production deployments, live/purchased Veriff calls, resets, mass formatting, or destructive data migration without separate authorization.

**Crucial override:** This owner decision **supersedes** KYC-01's previous `browse before government-ID verification` product rule and KYC-03's `provider result alone is sufficient for APPROVED` access behavior. **Preserve** the constraint that the provider is the only authority for document/selfie identity verification. Add a separate StrangeUp admin **activation** decision; an admin cannot override provider decline, expiry, revocation or missing verification. Record the supersession in an ADR and all policy/API docs. Never silently retain old full-account browsing on email verification alone.

## 0. First inspect evidence and current source

- Reference the original images/PDFs, particularly `Screen 06_ Sign Up.pdf`, `Screen 07_ ID Verification.pdf`, `Screen 1 — Government ID Verification.pdf`, `Screen 2 — Selfie Verification.pdf`, and nearby Login/Forgot Password screens. These establish **visual steps** but do not establish missing prototype connector semantics; owner explicitly confirms create-account to IDV and admin approval before Home.
- Inspect Task 021 implementation and status API, Veriff adapter/signed webhook, `auth.service.ts`, auth/session middleware, `hasFullAccountAccess`, `canAccessAccount`, `canBrowseDiscovery`, Activity KYC policy, admin/role scaffolding, all existing self APIs, and every app router.
- Trace the full API inventory in `CURRENT_APIS.md`, `openapi/*.yaml` and code. Do not trust earlier Cursor summaries without confirming source.
- Run quick baseline tests; establish current Neon migration status and ensure no secrets are logged.

## 1. Mandatory account lifecycle and explicit status model

Model **orthogonal authoritative state**, not a single overloaded `verified` boolean:

A. Account auth/security: registration, password/email verification, age 18+, consent acceptance, sessions, suspended/deleted.
B. **Identity verification** (provider-controlled): NOT_STARTED / SESSION_CREATED / IN_PROGRESS / SUBMITTED / PROVIDER_REVIEW (if returned) / APPROVED / DECLINED / RESUBMISSION_REQUIRED / EXPIRED / REVOKED (map actual available provider events precisely; never forge positive result).
C. **StrangeUp admin review** (platform-controlled): NOT_READY / PENDING / APPROVED / REJECTED / NEEDS_MORE_INFO; immutable decision history with reviewer, event timestamps and privacy-safe reason codes. Admin `APPROVED` is *not* vendor KYC `APPROVED`.
D. **Effective application access**: `ACTIVE` only when age eligible, canonical required consent accepted, email verified, account not suspended/deleted, currently valid provider-approved IDV, admin APPROVED for the **same current verification** and no revocation/expiry. Otherwise `ONBOARDING_REQUIRED` / `WAITING_FOR_VERIFICATION` / `WAITING_FOR_ADMIN_REVIEW` / `ACTION_REQUIRED` / `DENIED` as appropriate.

Design a finite-state machine with guarded transitions. Rejected/expired/resubmission flows must allow bounded remediation where product policy permits, but never self-grant Home access. Later new vendor attempts invalidate the admin approval tied to a previous attempt until re-approved (conservative safe default). Revocation or eligibility failure immediately revokes effective access even if cached sessions/JWTs exist.

**Account creation should NOT automatically provision full app access.** Where the verified provider data supports DOB/age, securely derive and enforce age >=18 from the authenticated provider response, not merely the self-declared registration DOB. A materially mismatched DOB/name or uncertain age requires a non-approved review state; retain only minimal derived comparison/age evidence, not full document data. Existing registration still requires DOB for 18+ and real canonical consent (do not invent legal versions). The Figma signup omits DOB and includes phone: document a required DOB Flutter UX reconciliation, maintain no mandatory SMS/phone-verification flow until separately approved. Avoid collecting unneeded phone PII.

## 2. Onboarding-safe session / API contract

Build or adapt **self-service onboarding status** readable by an authenticated, pending account, with restricted account token/session. Proposed route (adapt if Task 021 equivalent exists):

`GET /v1/me/onboarding/status` returns privacy-minimal:
`{accountStatus, emailVerificationStatus, ageEligibilityStatus, identityVerificationStatus, adminReviewStatus, homeAccessAllowed:boolean, nextAction, canStartVerification:boolean, canRetry:boolean, limitations, updatedAt}`. Use existing response envelope. Do not expose ID scans, biometrics, vendor secrets, raw webhook data or internal admin notes.

Provide safe onboarding initiation using existing Task 021 identity session endpoint (create only for authenticated owning user, opaque vendor session binding, rate-limited, no full-account prerequisite). If currently gated by `hasFullAccountAccess`, fix the circular dependency. Session URL delivered to current owner only and never logged.

After SDK completion, Flutter must call the status API or poll with bounded backoff; Flutter SDK completion is NOT a success decision. If provider APPROVED, status becomes `WAITING_FOR_ADMIN_REVIEW` until admin decision. Add optional endpoint to request resubmission **only** for allowed provider states, rate-limited and audited. No self-service admin approval route.

Allow pending accounts **only** necessary paths: register/login/refresh/logout, challenge verification/password reset, self onboarding status and identity-session initiation/status, consent read/acceptance where already authorized, minimum own account/security operations, support/retry. Everything else denied server-side. Keep admin routes separately authorized.

Return a consistent machine-readable `403 ONBOARDING_REQUIRED` / `ACCOUNT_NOT_ACTIVATED` with safe nextAction for all protected product endpoints, and preserve 401 for unauthenticated calls. Do not let a user directly call `/v1/home` or other APIs to bypass the Flutter waiting screen. Explicit endpoint inventory required; no wildcard ACL mistakes.

## 3. Enforce across **all** existing backend domains

Centralize eligibility in a tested reusable predicate/policy; avoid peppering one-off checks. Audit and update BOTH route middleware and service authorization, including: `/v1/home`, discovery/public users/avatars, groups/chat/content, activities browse/detail/publish/RSVP/private meeting, follow/wave/DM/notifications, store/cart/jobs/applications, memberships/settings overview and any other app data or private media endpoints.

Preserve role separation and privacy. Admin accounts are not automatically regular app users. Cross-user 404/blocks/D-03 privacy remain as before for allowed app users. Use reliable DB-backed current states for sensitive actions, not a JWT boolean minted once at signup. Correct any code where provider identity `APPROVED` alone is used as effective verification/visibility after this change. Real-world action gates still recheck KYC even after Home access; revoked identity must deny meeting details and waitlist promotion without silent deletion.

For already-registered users, make a safe forward-only migration/transition that **does not silently grandfather users into admin approval**, and does not delete or rewrite existing profile, posts, RSVP, sessions or other records. Record legacy classification and migration impact; preserve data, block effective access until requirements are met. Do not backfill fake provider decisions or backdate approvals. If a non-destructive legacy remediation is needed, report it.

## 4. Backend APIs for future StrangeUp Admin Panel

Implement admin-panel-ready APIs only, **no admin UI**. Propose exact final paths based on existing conventions, e.g.:

- `GET /v1/admin/identity-reviews?status=PENDING&cursor=...` paginated queue of provider-approved, genuinely reviewable accounts.
- `GET /v1/admin/identity-reviews/:reviewId` minimal review DTO with legitimate provider attestation/status, current attempt ID (opaque), necessary identity-match flags, email/account flags, timestamp; no raw selfie/ID document numbers by default.
- `POST /v1/admin/identity-reviews/:reviewId/approve` server-side state transition **only** if current provider approved, current 18+ eligible, requisite consent and email verified, no suspension/revocation; record actor, reason code and authoritative version.
- `POST /v1/admin/identity-reviews/:reviewId/reject` with bounded reason codes; prevent sensitive notes leaking to user.
- `POST /v1/admin/identity-reviews/:reviewId/request-more-info` if a controlled retry path exists (else leave this action disabled, document requirement).

Admin auth must be **real and separate**: restricted admin role assigned via controlled bootstrap/invite (no public admin signup, no self-promotion), strong session authorization, rate limits, audit trails, optional deployment-gated staff endpoints until admin provisioning and MFA/step-up security exist. All decisions enforce allowlisted admin role at both middleware and service/transaction layers. Admin must not approve own identity. No unprotected dev route to set KYC to APPROVED.

Use transactions/optimistic versions or row locks for simultaneous reviews; only one authoritative current decision per verification attempt; audit every attempt. Authorization should fail closed on unavailable datastore or vendor uncertainty. Allow a new IDV attempt to reset stale admin approval, not reuse it.

Privacy: Admin panel should usually review provider verification outcome and metadata. If the product later wants administrators to **inspect documents/selfies**, that requires a separately approved, least-privileged, auditable Veriff portal arrangement and retention/legal assessment; do not fetch/store biometric evidence in StrangeUp by default.

## 5. Veriff provider integration and webhook trust

Use approved sandbox adapter scope only. Keep production disabled, no real vendor calls without explicit credentials/test authorization. Source of identity outcome is verified Veriff **decision** webhook or authenticated decision query. Verify `x-auth-client` and `x-hmac-signature` over exact raw body with timing-safe compare, strict session/user binding, dedupe, event order protection, controlled status mapping, safe retries, and fail-closed error handling. Do not infer APPROVED from Flutter SDK `done`, session submission or unsigned client data.

Veriff's optional vendor status `review` is distinct from **StrangeUp Admin Review**. A normal provider `approved` result makes account eligible to ENTER StrangeUp's admin queue, but not Home. A provider `declined` or `expired` must never be overridden by StrangeUp admin approve.

Review callback replay, old session webhook after newer submission, concurrent admin decision and provider revocation; ensure fail-closed effective eligibility under these races. Reconcile existing Task 021 event schema and migrations rather than creating duplicate tables or contradictory status columns.

## 6. Tests / acceptance, not just documentation

Add automated tests and integration cases against isolated Neon `strangeup_test` covering at minimum:

1. Register returns onboarding-limited account/session; Home and other protected modules denied.
2. Login and refresh by pending user never grants access; no stale full-access JWT bypass.
3. A user may initiate/resume IDV even while not app-approved; no circular auth gate.
4. Client SDK `done` / submitted does not approve identity.
5. Unsigned/tampered/unknown-session/replayed/out-of-order Veriff webhook can't activate user.
6. Provider `APPROVED` alone leaves Home denied and enters admin review queue.
7. Unauthorized user, ordinary account and forged admin role cannot list/review/approve.
8. Admin approve only for current provider-approved verified/eligible user; audit actor; Home becomes accessible after all gates.
9. Admin reject/retry, provider decline/revocation/expiry all keep Home inaccessible and revoke prior access immediately.
10. Concurrent review actions + webhook races resolve deterministically.
11. Other users' private data/profile/media remain inaccessible; blocks/D-03 unaffected.
12. Legacy previously active user without admin decision becomes appropriately restricted without data loss; report impact.
13. Existing Task 010 KYC-host/join/RSVP/meeting checks and Task 011 messaging consent remain secure.
14. Email verification, DOB >=18, canonical consent missing/obsolete status deny effective activation; no invented legal IDs.
15. App endpoints include direct-route bypass tests (Home, Discover, Groups, Activities, Social, Chats, Store, Jobs, Notifications, Membership) for pending/rejected user.
16. Test suite authenticates admin through the real admin role mechanism, never insecure test-only production bypass.

Run `prisma validate`, `generate`, typecheck, lint, unit tests, build, full `RUN_INTEGRATION=1 npm run test:integration` against isolated Neon. Check migration status/identity; no reset/truncate on dev or production. Format only changed files; report existing repo-wide format failure honestly.

**Acceptance:** A pending applicant **cannot** access Home or any main product API even with a valid access token. Provider-approved-only applicant **cannot** access Home. An authorized admin approval for a currently valid provider-approved adult account with email and consent fulfilled grants access, without requiring a new account. Access is immediately denied on suspension, admin withdrawal, identity revocation/expiry, or invalid eligibility. All results supported by actual automated tests. No fake provider/admin decisions in production.

## 7. Docs, handoff and status

Update `docs/decisions/` with owner-approved AUTH-FLOW-2026-10-28 policy superseding earlier browse-before-KYC/sole-provider-approval assumptions, `docs/api/CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md`, `openapi/identity.yaml` and admin OpenAPI, `STATUS.md`, `ACTIVE_SCOPE_AND_DEFERRALS.md`, Figma flow parity matrix and security tests. Define exact frontend state/nextAction handling but **do not edit Flutter**.

Explicitly flag visible Figma-to-policy conflicts: missing DOB field, phone present but unverified, missing email verification screen, false instant automated approval copy, E2EE claims, home-after-approval screen not yet supplied. Flutter implementer must not present user as fully approved based on SDK `done` or provider decision alone.

Return ONE detailed final engineering report: old vs new auth policies, changed files/migrations, endpoint status, state-machine table, admin permissions/bootstrapping, effective-access enforcement inventory, every unit/integration test count, deferred Veriff production activation and consent legal blockers, verified vs unverified behavior, no claim of 100% correctness until evidence.

## Official Veriff references (verify current details, do not infer custom schemas)

- SDK/Flutter result vs decision: https://devdocs.veriff.com/v1/docs/flutter-plugin
- Decision webhooks: https://devdocs.veriff.com/docs/decision-webhook
- Raw body signatures: https://devdocs.veriff.com/v1/docs/hmac-authentication-and-endpoint-security
- Provider review status caveat: https://devdocs.veriff.com/docs/verification-session-decisions
