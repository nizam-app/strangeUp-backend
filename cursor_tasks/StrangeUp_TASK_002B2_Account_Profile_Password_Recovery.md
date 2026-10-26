# StrangeUp — Task 002B.2: Password Recovery, Self Account, Narrow Profile

**Task type:** Bounded implementation, integration/security verification, Flutter handoff, and milestone closure.
**Repository:** Existing `strangeup-backend` on Windows/Cursor.
**Prerequisites:** Tasks 001, 001.1, 002A, 002A1, 002B.1, and 002B.1A completed as described by their reports.
**Source of truth:** Actual repository + migrations + executed tests, `AGENTS.md`, `.cursor/rules/`, `docs/decisions/ADR-004-identity-phase1-owner-decisions.md`, identity architecture/API drafts, current API docs, and accepted decisions.
**Status:** Implementation instructions only; no code has been created by this task document.
**Hard boundaries:** No production access, no live KYC or email provider, no social/discovery/chat, no membership/commerce, no OAuth or phone OTP, no new public user-directory API, and no unapproved product rule.

## 0. Start with repository evidence, not assumptions

1. Read `AGENTS.md`, applicable `.cursor/rules/`, `docs/plans/STATUS.md`, ADR-004, `docs/product/IDENTITY_DECISION_REVIEW.md`, `docs/architecture/IDENTITY_DESIGN_PROPOSAL.md`, `docs/api/IDENTITY_API_DRAFT.md`, `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`, `docs/testing/IDENTITY_ACCEPTANCE_MATRIX.md`, `openapi/identity.yaml`, and this task.
2. Inspect current `src/modules/auth/`, authentication middleware, policy stubs, Prisma models and migrations, test setup, and error/envelope conventions. Confirm **actual** DTO fields and routes. Review any in-repo `TASK_002B_2_*` instructions; reconcile scope rather than running two overlapping tasks.
3. Run `git status --short`, `git diff --check`, inspect tracked vs untracked files and `.gitignore`. Task 002A/002A1 and 002B.1/002B.1A work may remain uncommitted. Do not reset, overwrite, or lose any changes. Produce the proposed logical commit/checkpoint plan before further edits. **No commit, push, remote creation, or history rewrite without owner authorization.**
4. Record findings and any contradictions first, especially account eligibility, pending/unverified access, approved profile fields, existing AuthChallenge schema, and password-reset semantics. Label unresolved product choices explicitly. Avoid edits whose behavior depends on an unresolved consequential decision.

## 1. Scope: three small API slices

### Slice A — Password recovery (server, no real delivery)

Implement the approved password recovery flow, reusing existing identity infrastructure where safe. Prefer existing documented `/v1/auth/forgot-password` and `/v1/auth/reset-password` endpoint names **only after comparing with repository drafts and Flutter conventions**; final contract must match code and OpenAPI.

**Request:**
- Public request accepts normalized email, always returns a generic success/accepted response that does not disclose whether an account exists, is suspended, or is eligible.
- Apply abuse controls per requester/IP and account/email as suitable; evaluate current in-memory limiter and trusted-proxy configuration; document that production/distributed protection remains pending.
- Issue a CSPRNG-generated opaque token, store only its secure hash, associate it with one user and a clearly typed purpose, enforce a bounded expiry and one-time use; do not recycle an email-verification challenge across purposes.
- Reuse `EmailSender` abstraction. In dev, use an explicit test-only capture mechanism if tests need to obtain tokens; never return tokens from public API, leak secrets to production logs, or represent dev stub as email delivered.

**Confirm:**
- Validate the token, expiry, purpose, account state and proposed new password; consume the challenge **atomically** so concurrent reset attempts cannot both succeed; hash the new password with the project's supported password hashing scheme.
- On success, revoke all outstanding sessions/refresh tokens for that account. Existing access tokens must fail future protected requests because active-session checking is enforced.
- Invalid, expired, consumed or replayed reset tokens must fail with consistent safe errors; password unchanged. Do not issue a login session automatically unless already explicitly approved; default to a fresh login.
- Ensure password-reset links, if assembled server-side, use an explicitly configured trusted base URL (never an untrusted `Host` header). Keep reset-token data out of analytics/referrers/verbose logs.
- Do not create email delivery service integrations in this task.

### Slice B — `GET /v1/me/account`

- Authenticated **self only**. No user ID in path/body, and no lookup of other accounts.
- Design a minimal, explicit DTO from existing persisted fields: user ID, normalized/current email if approved, accountStatus, emailVerified state, ageEligibility, KYC status explicitly *not verified* unless source-of-truth says otherwise, and required app-facing timestamps. No passwordCredential, tokens, challenge secrets, exact KYC artifacts, or internal moderation flags.
- A logged-in **pending** user may need to read *their own account status* to complete verification, without granting full product access. Confirm this narrow exception against existing limited-session policy; explicitly test it. Suspended/revoked/deleted accounts must be denied according to existing policy. Do not infer entitlement from the token's `fullAccess` response field; check persisted state on every protected request.
- Use exact existing envelope and stable error codes. Do not accidentally add a `GET /v1/users/:id` or any public profile route.

### Slice C — `GET /v1/me/profile` and `PATCH /v1/me/profile`

- Only the authenticated user may read or modify their own profile. Require active/verified/age-eligible status for profile edits unless a pre-approved onboarding exception is documented; deny suspended and blocked states.
- Restrict PATCH fields to an **explicitly approved narrow allowlist** that is supported by existing Prisma `Profile` and source UI docs. Do not invent full social profile, interests, photos, geo coordinates, tags, gender, dating preferences, or other sensitive fields. Do not silently add Prisma columns merely because a Figma field appears.
- For any ambiguous field, leave it out, document it as proposed, and proceed with the approved minimum. Enforce validation, normalization, length limits, and correct null/empty/omitted semantics. Reject or safely ignore unknown fields according to the existing project API convention; never mass-assign `req.body` into Prisma.
- DOB, legal consent, account status, email verification, role, ID/KYC and billing entitlements **must not** be writable via generic profile PATCH.
- Return only a deliberately selected response projection. Ensure a user cannot edit another user by injecting `id`, `userId`, `ownerId`, or nested objects.
- Do not create public profile visibility or discovery behavior here.

## 2. Prisma, migrations and transaction safety

1. Reuse existing `User`, `PasswordCredential`, `Session`, `AuthChallenge`, `ConsentRecord`, `Profile` models. Add migration only when a justified minimal schema change is required. Do **not** rewrite the previously applied `20261026065612_identity_phase1` migration.
2. Check whether AuthChallenge has a type/purpose, expiry, consumed marker and the indexes needed for password recovery. Use stable uniqueness/constraints where needed; do not assume a DB mutation is atomic simply because two requests pass separately.
3. Password hash update, challenge consumption, and session revocation must have coherent failure/transaction behavior; test rollback and retry semantics. Never store raw reset tokens or plaintext passwords.
4. Run migrations only against confirmed **development/test** DBs, after reviewing generated SQL. No reset, drop, destructive migration or production database action.
5. Distinguish PGlite-backed Prisma Dev test results from native PostgreSQL concurrency evidence. Native PostgreSQL concurrency tests remain a pre-staging gate if unavailable.

## 3. Mandatory security audit items inherited from 002B.1A

- Confirm exact scrypt `N`, `r`, `p`, key length, node `maxmem`, stored hash format and password-hash verification compatibility. Cursor reports N=16384 but r/p were omitted. Compare complete configuration with current OWASP guidance. **Do not silently change existing hashes or locking/CPU cost**; if insufficient, propose a compatible versioned/rehash-on-login strategy and benchmark tests, then report whether a change is safe in current scope.
- JWT verification uses allowlisted HS256; earlier report says no issuer/audience checks. Evaluate whether explicit `iss`/`aud` should be included and enforced before broadening the API surface, and how to preserve token compatibility. Do not silently break existing sessions.
- Address the documented **email resend/confirm throttling gap** (F-08) with scoped abuse tests if appropriate while touching challenge flows, or mark it as a specific hardening blocker with owner-facing rationale.
- Review reset request rate-limiting and IP/proxy correctness. In-memory `Map` is not adequate production-wide protection across multiple replicas; keep distributed throttling as a separate deployment gate unless this task explicitly approves infrastructure.
- Verify no secret value appears in HTTP responses, normal request logs, Git-tracked files, error envelopes, Flutter documentation, or production-config example values.
- Existing `canInteractWithUser` must stay default-deny. No social/contact entitlement introduced.

## 4. Tests (must be executed, not merely written)

**Password recovery:**
- Known vs unknown email: same public response/error contract; fake or unavailable email delivery is explicitly noted.
- Reset token: valid, invalid, tampered, expired, consumed, wrong purpose, wrong account, duplicate replay, and concurrent submit.
- Password: enforce established password policy; old password fails after reset, new password works; no plaintext persisted.
- Sessions: old access and refresh tokens rejected after reset, multiple devices revoked; no automatic session unless approved.
- Suspended/deactivated user and abuse throttling; reset request cannot be used to enumerate users.

**Account/profile:**
- Pending user can access only explicitly allowed self-account status; no broader product access.
- Active verified user can GET/PATCH own profile within narrow allowed fields.
- Unknown/privileged fields including `role`, `id`, `userId`, `dateOfBirth`, `accountStatus`, `emailVerified`, KYC flags rejected and never persisted.
- Token missing/expired/revoked; user suspended; distinct users and cross-user update attempt; validation rejects empty/oversized/invalid patch values.
- Payload/result contains no password hash, refresh token, challenge/token hash or sensitive internal metadata.

**Regression:** existing registration, login, email verification, refresh rotation/CAS, logout/logout-all, suspension, DOB and consent persistence tests continue to pass.

Report pass/fail/skip by actual test name and runtime/DB type. Do not label an integration run as fully passed if its critical cases were skipped.

## 5. API contracts and Flutter handoff — mandatory same task

Update **all three** after any route ships or changes:
- `docs/api/CURRENT_APIS.md` — exact method/path, LIVE/DEV_ONLY/PLANNED status, middleware/eligibility, input/output DTO, stable errors, rate limit, idempotency, tests and source file paths.
- `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` — password reset UX, verification state, pending account self-info, profile GET/PATCH allowlist, secure token storage, logged-out-after-reset, error mapping, token revocation recovery, concrete Dart DTO/request examples using **synthetic** data, and known limitations.
- `openapi/identity.yaml` — authoritative machine-readable contract synchronized with actual runtime, not the draft.

Additionally update `docs/testing/IDENTITY_ACCEPTANCE_MATRIX.md` and `docs/plans/STATUS.md` with actual evidence and remaining release blockers.

**Important:** A recovery API that relies on the dev email stub may be implemented and tested but **is not an end-to-end production-ready user recovery flow**. Make this distinction prominent to Flutter developers.

## 6. Commands and Git gate

Required commands, if supported by repository scripts:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
$env:RUN_INTEGRATION = '1'
npm run test:integration
Remove-Item Env:RUN_INTEGRATION -ErrorAction SilentlyContinue

git diff --check
git status --short
```

Use the existing isolated integration DB (`INTEGRATION_DATABASE_URL`) with explicit dev/test URL separation. If test DB cannot be reached, report blocker; do not substitute dev/production DB. Do not install Docker or external infrastructure without approval.

Before Task 002B.2 source modifications, establish the current uncommitted-diff inventory and *recommend* logical local commits for 002A/002A1 docs, 002B.1 Auth, and 002B.1A security fixes. **Only perform commits if the owner explicitly authorizes them.** Avoid automatically merging unrelated docs and code into an opaque single commit. Always keep `.env`, `generated/`, `node_modules/`, `dist/` and secrets out of commits.

## 7. Completion report — mandatory

1. Exact files added/changed, package and Prisma migration changes.
2. Every LIVE or DEV_ONLY route and final request/response schema.
3. Security audit of reset token handling, session revocation, authorization, hash config, rate limiting; distinguish VERIFIED / DEFECT FIXED / OPEN.
4. All commands executed with actual pass/fail/skip and evidence; which DB engine ran.
5. User-visible Flutter integration instructions and links to `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md`, OpenAPI.
6. Git `status`, checkpoint/commit status and untracked/ignored secret checks.
7. Production blockers still pending: counsel-approved consent versions, real email provider, distributed abuse controls, native PG concurrency evidence, policy/legal review, and product-specific KYC gates.
8. Clear proposed next task. Do not implement Task 002B.3, profile media, KYC or discovery without new approval.

## External security references

- OWASP Forgot Password: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- OWASP Password Storage: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

**Definition of done:** code + live DB integration evidence + negative/security tests + updated OpenAPI + `CURRENT_APIS.md` + `FLUTTER_DEVELOPER_HANDOFF.md` + accurate status report. No untested success claim.
