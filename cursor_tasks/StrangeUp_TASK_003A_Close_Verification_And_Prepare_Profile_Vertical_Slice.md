# StrangeUp — Task 003A: Verification Closure & Profile Vertical-Slice Readiness

**Purpose:** Close the verification failures from Task 003 and prepare, but do not pre-empt, approved user-facing profile functionality. **No unnecessary documentation-only milestone.**

## Binding context
- Git baseline last reported: `7a56cc8` plus uncommitted KYC/design-reference/Task 003 work. Verify actual HEAD; never assume unchanged.
- Figma source: `design-reference/` PDFs, especially `Html → Body-1.pdf` (Edit Personal Details), `Screen 06_ Sign Up.pdf`, `Screen 26_ Profile & Settings.pdf`, `Screen 10_ User Profile.pdf`; inspect real local files.
- Owner-approved: US-first, adults-only, email/password, DOB at signup and consent, email verification, separate age/KYC, KYC gate for real-world actions, approved KYC-03/05/ENF rules. No KYC provider, payments, or public/social APIs authorized.
- Live `/v1/me/*` scope: existing read/account/profile and narrow profile PATCH. Bio maximum 500 is LIVE; Figma counter 300 is **not** an approved backend change yet.
- Current evidence: Task 003 reportedly 32 unit tests passed; formatting failed on pre-existing README; integration unavailable because local Prisma Dev test instance stopped. Do not claim complete verification until executed.

## Workstream A — close Task 003 verification (execute now)
1. Inspect `AGENTS.md`, `.cursor/rules/`, `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md`, `docs/plans/STATUS.md`, current `git status`, database configuration and existing README recovery instructions. Do not print secret environment values.
2. Confirm `DATABASE_URL` and `INTEGRATION_DATABASE_URL` resolve to distinct databases/instances and the integration fail-closed guard is intact. The last known test instance was `strangeup_test` on `localhost:51218`; verify with `npx prisma dev ls`, then recover with supported repo commands such as `npx prisma dev start strangeup_test` where appropriate. Never aim migrations or destructive test fixtures at development or production.
3. Apply existing migrations to the isolated test target only, using the repository's actual Prisma 7 CLI/config process. Re-run `RUN_INTEGRATION=1 npm run test:integration`; record pass/fail/skips and which database actually ran.
4. Diagnose the single README `format:check` failure. If truly only nonsemantic Prettier formatting, make the smallest possible formatting change; inspect its diff. Do not indiscriminately format unrelated files or overwrite the README content.
5. Re-run `npm run prisma:validate`, `npm run prisma:generate`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, integration suite, and `git diff --check`. Record actual output, not assumed passes.
6. Check that Task 003 tests cover: strict PATCH allowlist and unknown keys; blank body; DOB rejection; profile GET for pending user and PATCH denial; suspended/deleted denial; email verification / age gates; 500/501 bio; valid/invalid IANA timezone; name changes.
7. If tests are blocked by a genuine external limitation, document it explicitly and keep status as incomplete. Do not claim production approval.

## Workstream B — next profile implementation readiness (no guessed changes)
1. Read **actual** `Html → Body-1.pdf` and the source-backed `docs/product/FIGMA_PROFILE_PARITY_MATRIX_2026-10-26.md`. Distinguish UI-proven controls from approved persistence/authorization rules. Confirm available original Figma PDFs remain in the repository.
2. Present a short **owner decision checklist** limited to what enables the next coding slice:
   - D-BIO-MAX: retain live 500 or align new writes/UI with Figma 300; assess existing rows before tightening.
   - Username: optional/required, uniqueness/normalization/allowed characters/edit policy.
   - Interests and favorite activities: exact UI options and whether selections are tags or links to real records; avoid inventing taxonomy.
   - D-04: optional US city/state vs precise location, meaning of displayed “Verified”; no unsupported precise-distance claims.
   - Profile photo: storage provider/allowed formats/size, moderation and removal; distinguish production vs local dev.
   - D-03: `Everyone` / `Verified Users Only` audience definitions and public profile visibility, distinct from email/KYC/account status.
   - Signup: DOB+consent required by approved backend but absent from current Figma signup; phone remains unresolved; marketing claims such as universal ID verification and E2EE cannot be treated as shipped.
3. Recommend the **smallest true user-facing vertical slice** after decisions (rather than another parity matrix): suitable Prisma schema changes, API endpoints, validation, authorization, negative/integration tests, and Flutter contract updates. If Flutter source is not in this repo, describe exact Flutter integration instructions but do not claim Flutter UI was changed.
4. Update `ACTIVE_SCOPE_AND_DEFERRALS.md` and `STATUS.md` minimally with verification findings, next slice, open approvals and deferred integrations. Update `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md`, and OpenAPI **only** if their actual contracts changed; never promote PLANNED to LIVE prematurely.

## Hard restrictions
- Do not invent Figma fields, alter DOB or KYC gates, add social routes, manufacture verification/payment/entitlement states, integrate Stripe/KYC, apply destructive migrations, or perform production operations.
- Do not commit/push without owner authorization; preserve unrelated changes and sensitive files.
- No new product feature until its necessary owner decisions are approved; technical repairs/tests are authorized by this task.

## Completion report
Give (1) exact original test blocker + fix, (2) execution evidence for all quality checks including integration DB identity, (3) minimal file changes, (4) remaining profile decisions with recommended defaults and impact, (5) precise next implementation task, (6) Git status. Be explicit if the task is still blocked.
