# StrangeUp — Task 002B.1A: Auth Security Verification & Closure

**Task type:** Existing implementation audit, evidence-based targeted fixes, regression tests, and documentation sync.
**Repository:** Existing `strangeup-backend` working tree.
**Prerequisites:** Tasks 001, 001.1, 002A, 002A1, and 002B.1 reported completed.
**Source of truth:** Repository source, actual migrations, executed tests, approved ADR-004, plus `AGENTS.md` and project docs.
**Constraint:** This is *not* a new auth implementation. Preserve working behavior and do not introduce new product rules.

## 0. Initial inspection — mandatory

Before edits:
1. Read `AGENTS.md`, `.cursor/rules/`, `docs/plans/STATUS.md`, `docs/decisions/ADR-004-identity-phase1-owner-decisions.md`, the existing Task 002B.1 file, `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`, `openapi/identity.yaml`, `docs/testing/IDENTITY_ACCEPTANCE_MATRIX.md`, and all actual auth/policy implementation and tests.
2. Run `git status --short`, inspect tracked vs untracked files and differences. Existing 002A1 docs and 002B.1 implementation are reportedly not committed. Preserve all unrelated edits and do not discard or reset anything.
3. Inventory exact routes, input/output DTOs, middleware ordering, permission checks, SQL constraints, migration contents, test cases, runtime environment requirements and the existing email dev stub. Do not infer a feature works merely because its route exists.
4. Give short findings ordered by severity before changing code. Label `VERIFIED`, `DEFECT`, `UNTESTED`, or `PRODUCT DECISION NEEDED`.

## 1. Priority security invariants — inspect and test

### 1A. Unverified, underage, suspended or revoked users
- Registration must **not** issue access/refresh tokens (per Task 002B.1 agreement).
- Login's limited session for an unverified but age-eligible user must not allow full-access actions. Check enforcement against persisted account and session state on **every protected operation**, not merely `fullAccess` in the login JSON/JWT.
- Inspect what `ACTIVE`, `PENDING`, `SUSPENDED`, deactivated, and failed-age eligibility mean in current code; do not silently invent additional account transitions.
- Verify that suspended/deactivated users cannot use previously issued access/refresh tokens or obtain new full-access sessions. Add explicit integration coverage for I-N04.
- `canInteractWithUser` currently hard-denies all: keep this behavior until actual interaction policies are approved; document that social/discovery remains unavailable.
- Keep email verification, age eligibility and KYC as separate dimensions; DOB self-declaration is **not** proof of identity.

### 1B. Refresh token security
- Inspect transaction boundaries, database uniqueness/optimistic compare-and-swap assumptions, expiry, rotation, `previousRefreshTokenHash`, replay handling and family/session revocation.
- Test legitimate sequential rotation, revoked and expired tokens, replayed old token and a concurrent two-refresh scenario where feasible.
- Verify two simultaneous valid refresh requests cannot create two independently valid refresh tokens. Do not claim native PostgreSQL concurrency correctness based only on PGlite tests.
- If a previous token is reused, family revocation must be evidence-based and aligned with documented expected behavior. Consider unintended forced logout from legitimate parallel Flutter requests; define client-side serialization in the Flutter handoff, without weakening replay detection.
- Confirm JWT validation uses explicit algorithm allowlisting, expiry, appropriate issuer/audience if configured, active-session lookup, and user state checks; report absent controls as verified findings instead of quietly changing contract.

### 1C. Logout and revocation
- Integration test logout-current (I-P04), logout-all, revoked access token, revoked refresh token, and cross-session behavior. Ensure no credentials are logged.
- Verify logout is safe on repeated requests as required by actual contract; do not assume unapproved response semantics.

### 1D. Registration / email verification / consent
- Test DOB at 18th birthday, just under 18, impossible/future DOB, leap-day and timezone/date-only edge cases. Do not restrict physical access to Bangladesh-based developers because the target launch market is USA.
- Audit email normalization and unique registration conflict behavior; protect against enumeration where the approved contract permits. Verify register idempotency: same key/same request; same key/different payload; collisions, race conditions, expiration and no sensitive request body persisted.
- Verify email challenge randomness, hashing, expiration, one-time use, resend/attempt throttling, replay rejection, invalid tokens, and that production API/logs do not expose raw verification secrets. Dev stub must not be misrepresented as delivery.
- Consent evidence must include actual acceptance state, timestamp, document type and supplied version, but **client-supplied version strings are not server-authoritative**. Do not invent final policy IDs, text or versions. Record a release blocker until counsel/product-approved versions are enforceable.
- No live email service, KYC, OAuth or password reset in this task.

### 1E. Secret handling, password hashing, and abuse resistance
- Inspect scrypt parameters, random salt, secret comparison and persistence format against the current OWASP password storage guidance; do **not** replace a working scheme without a specific justified reason. Note if cost/parameters need an environment-aware performance evaluation.
- Audit JWT secret strength, failure-on-missing config, `NODE_ENV` safeguards, logging redaction, request payload size limits, CORS intent, and authentication error envelopes.
- Confirm in-memory IP/email rate limits work under current dev setup and explicitly document that multi-instance/production throttling is not validated. Check reverse-proxy/IP trust assumptions rather than assuming all clients have unique source IPs.
- Test wrong password, nonexistent email, account status behavior and unexpected errors for enumeration or secret disclosure.

## 2. Tests and migration evidence

- Add or repair only targeted tests needed to cover verified gaps. Reuse existing test utilities and existing integration DB isolation guards.
- Run: `npm run prisma:validate`, `npm run prisma:generate`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build` and enabled DB integration tests using the existing project-prescribed environment commands. Use **test** DB, not the development database, for potentially mutating integration tests.
- Report actual test names/counts and skips separately. For previous missed cases, explicitly identify whether they now pass.
- Inspect the already-applied identity migration; do not rewrite an applied migration, reset DBs, apply production migrations or add unrelated business models. If native PostgreSQL is unavailable, label its concurrency suite unverified with an explicit deferred gate, without installing infrastructure without approval.
- If a material defect requires changing the API schema, authorization semantics or data model, show the proposed smallest change and its compatibility/migration impact before applying a major or destructive change.

## 3. Mandatory documentation synchronisation

For any API-facing or behavioral fix, update together:
- `docs/api/CURRENT_APIS.md` — only truly LIVE endpoints with exact methods/routes, auth requirements, DTOs, error cases and test evidence.
- `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` — actual Flutter auth flow, verification gating, JWT vs refresh handling, **serialized refresh requests** on mobile, secure token storage guidance, 401/403 treatment, error envelopes, integration readiness, and limitations of the dev-only email stub.
- `openapi/identity.yaml` — keep source-compatible with the implementation.
- `docs/plans/STATUS.md`, `docs/testing/IDENTITY_ACCEPTANCE_MATRIX.md` — mark actual verified/pending results. Preserve the 18+ USA-first decision and open KYC/consent/phone rules.
- Do not advertise password reset, `/v1/me/*`, OAuth or KYC as implemented.

## 4. Git hygiene, no unauthorized commit

- Summarize the 002A1 documentation and 002B.1 code as separate logical change groups. Check `git diff --check`, `.gitignore`, `git status`, and repository tracking for secrets, generated Prisma output, `.env`, `node_modules`, `dist` and credential-bearing logs.
- Propose clean local commit grouping and draft commit messages; **do not commit, push, rewrite history, add a remote, or discard changes unless the product owner explicitly approves**. Do not include credentials or customer information in completion output.

## 5. Definition of done / required final report

1. Actual source and migrations reviewed; important security findings with file/line evidence (or clearly marked unverified).
2. Focused defects corrected without unrelated refactoring; necessary API docs updated.
3. New verified tests cover logout and suspended paths, and evaluate refresh replay/permissions, plus core negative verification and DOB cases; report any remaining gaps explicitly.
4. Commands and integration results reported with pass/fail/skip, including whether DB was PGlite or native PostgreSQL.
5. Git status and proposed checkpoint plan documented; no automatic commit.
6. State which issues are **blocking Task 002B.2 development** vs only **blocking staging/production release**.
7. Recommended next step: Task 002B.2 (password reset, `/v1/me/account` and narrow profile read/PATCH), only after relevant Task 002B.1A blockers close. No implementation of 002B.2 in this task.

## External engineering references (guidance, not a substitute for source inspection)

- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- RFC 9700 refresh-token rotation: https://www.rfc-editor.org/rfc/rfc9700.html
