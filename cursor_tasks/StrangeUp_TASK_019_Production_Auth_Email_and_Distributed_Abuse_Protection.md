# StrangeUp — Task 019: Production Authentication Email and Distributed Abuse Protection

**Type:** Backend implementation + test milestone (NOT another docs-only task)

**Context (Cursor-reported Task 018 baseline):** Node.js/TypeScript/Express/Prisma/Neon; 169 passing unit tests, 97 passing integration tests, 1 intentional skip; 13 applied migrations; `format:check` fails on 245 files (218 line-ending only, 27 substantive). Task 018 implemented production startup guards, but all transactional email is not yet production-connected and rate limits are in-memory only.

## Governing constraints
- BACKEND ONLY. Do not access or modify Flutter.
- Preserve all existing endpoints, policies, D-03/D-04 privacy, KYC gates, blocks, consent, session security, concurrency, and all Tasks 006–018 functionality.
- No commits, pushes, database resets, production operations, account provisioning, external real-email sends, or credential changes without explicit owner instruction.
- D-06 interactive community media remains disabled, D-08 Club billing and store checkout remain unavailable, destructive account deletion remains off, KYC provider approval cannot be fabricated.
- Do NOT silently select a production email provider or Redis vendor, enable live sending, or change API behavior to pretend delivery succeeded. Provider candidates: Resend (transactional email) and managed Redis/Upstash (rate limiting); owner/vendor selection and credentials are separate gates.

## Part A — audit + implement production-safe email transport boundary
1. Inspect actual source for registration verification request, password reset, email-change request/confirm, previous-email notices and any other existing notification sender. Catalog concrete DEV_ONLY, live, and production-disabled behavior. Look for any accidental production stub, challenge leak or false delivery acknowledgement.
2. Define/implement a small typed transactional email transport interface with **development/testing fake sender** and a **disabled/fail-closed production sender**; keep existing auth challenge invariants: hashed, one-use, expiry, throttling, enumeration-safe responses, safe token URLs, session revoke on change, never log tokens.
3. If a provider-neutral interface or equivalent abstraction already exists, reuse it; do not introduce duplicate layers or gratuitous rewrites. Add a production-provider adapter only after the owner has explicitly selected the provider; do not create a working Resend integration or external sends on an unapproved assumption.
4. Ensure that production startup and endpoints cannot claim real transactional-email capability without a configured, approved transport, verified sender/domain and required secrets. Distinguish accepted request vs message handed off vs delivered (do not equate an API acceptance response with inbox delivery). Preserve nonenumeration while ensuring legitimate users do not get unusable security flows.
5. Add focused unit / integration tests with mock transport: success, transient provider errors, duplicate sends/retries, challenge lifecycle, old-email notice, missing credentials and fail-closed production conditions. Validate that secrets and confirmation tokens never appear in responses/logs.

## Part B — distributed abuse-prevention foundation
1. Inventory every in-memory rate limiter (auth, email change, message send/requests, follow, wave, activities, groups, stories, reporting, jobs, etc.). Document the current limiter keys/limits and do not weaken them.
2. Implement one reusable backend limiter adapter/contract that can operate against a shared server-side store (Redis-compatible) in the future. Keep deterministic local test implementation; preserve current development behavior where safe. Avoid making Redis an unapproved mandatory dev dependency.
3. A real Redis/Upstash client should be activated only if the user has approved the service and provided credentials locally. In production, any auth-critical/messaging-abuse limiter must fail closed or deny the sensitive action when its required shared backend is absent/unavailable; do NOT fall back silently to a per-process limiter or permit-all. Review vendor-library timeout defaults carefully (some permit requests when the store times out).
4. Add tests demonstrating multiple simulated app instances with shared rate-limit counts, per-user+per-IP enforcement, HTTP 429 responses, reset windows, store outage handling and privacy-safe logs. Existing integration tests must keep using the isolated `strangeup_test` database.
5. If implementation requires provider-specific configuration not yet approved, deliver independently useful adapter/test code and explicitly mark the real shared-store activation PENDING; do not claim distributed limits production-ready.

## Part C — verified quality and developer handoff
- Run `prisma:validate`, `prisma:generate`, `typecheck`, `lint`, `test`, `build`, and full `RUN_INTEGRATION=1 npm run test:integration` on the isolated Neon test database; avoid irreversible operations.
- Do not mass-format 245 unrelated files or run `git add --renormalize` without owner approval. Keep `format:check` status explicit; format only changed files as allowed.
- Update `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md`, relevant OpenAPI files, `STATUS.md`, `ACTIVE_SCOPE_AND_DEFERRALS.md`, and a short operations runbook only where code changed.
- Return one engineering report: paths changed, real delivery status for every email flow, limiter inventory + actual shared-store coverage, tests counts, policy decisions needed, release blockers, `git status` and precise next owner actions.

**Explicit non-goals:** Stripe/IAP, subscription ledger, checkout, KYC vendor integration, real account deletion, media activation, manual contact uploads, production credential provisioning, production deployment, mass formatting, and commits/pushes.
