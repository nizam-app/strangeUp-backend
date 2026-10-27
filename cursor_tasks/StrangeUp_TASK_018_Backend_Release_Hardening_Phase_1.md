# StrangeUp — Task 018: Backend Security, Reliability & Release Hardening (Phase 1)

**Task type:** Implementation + automated verification, NOT a documentation-only review.  
**Owner status:** Authorized for independent security/reliability improvements within existing approved product behavior. Unapproved policy-dependent product activation and external integrations remain blocked.  
**Repository:** `strangeup-backend` — Node.js / TypeScript / Express / Prisma / Neon PostgreSQL.  
**Scope:** Backend only. No Flutter work, production operations, commits, pushes, destructive resets or migration rewrites.

## Verified starting baseline (Cursor-reported Task 017)

- Tasks 006–017 implemented; isolated Neon regression reports **156 unit tests passed**, **97 integration tests passed, 1 intentional skipped placeholder**.
- `prisma validate/generate`, typecheck, lint and build pass.
- `format:check` FAILS with pre-existing Windows CRLF / Prettier drift affecting approximately **239 files**; root cause and change scope not yet independently categorized.
- Membership: default BASIC/FREE; CLUB is NOT_CONFIGURED; no billing or premium privileges.
- Community Story/photo/poll interactive routes disabled with `GROUP_COMMUNITY_INTERACTIVE_ENABLED=false` pending D-06.
- Product checkout unavailable; job application employer delivery not configured; email-change is DEV_ONLY; production KYC vendor not integrated.

## Goal

Raise confidence in the implemented backend, eliminate actionable code-quality or security defects, and produce an accurate, repeatable release-readiness gate. Do **not** build pretend billing, activate unapproved features, or turn the milestone into a documentation-only audit.

## Step 1 — Establish a trustworthy test baseline

1. Inspect `AGENTS.md`, `.cursor/rules`, current status/deferrals, scripts, package configuration, CI configuration if any, and integration DB safety guards.
2. Run the current non-destructive gates against the known-safe environments: Prisma validate/generate, typecheck, lint, unit, build, and isolated Neon integration tests. Keep actual counts and failures, including skipped tests.
3. Verify DB identity before any integration cleanup. Integration `TRUNCATE` must target only `strangeup_test`; fail closed for unknown, shared, production or development DBs. Do not echo connection secrets.
4. Confirm all migrations are accounted for on dev/test using non-destructive Prisma status checks. Never reset, baseline, squash, rewrite previously applied migrations or modify production.

## Step 2 — Fix or accurately isolate the formatting gate

1. Determine how many of the ~239 flagged files are **line-ending-only** versus genuine Prettier formatting violations. Report counts and representative files.
2. Inspect `.gitattributes`, `.editorconfig`, Prettier and package scripts; propose stable LF settings for cross-platform work.
3. Apply small, safe, non-semantic changes (including tool configuration and formatting of **new/modified** files) where possible. Re-run typecheck, tests and lint after edits.
4. **Do not mass-reformat hundreds of unrelated files without explicit approval**, and do not disable, falsely report, narrow, or silently skip the failing repository-wide format gate to obtain an artificial green status.
5. If repository-wide cleanup would cause a large diff, leave the global gate correctly marked FAILED, report the exact remaining scope, and provide a separate one-time mechanical normalization plan. Do not block the independent security/testing work on this issue.

## Step 3 — Implement targeted security and correctness regression coverage

Inspect real current code and add minimal fixes and automated tests for verified defects in these cross-module invariants:

- **Identity/auth:** verified-email and 18+ eligibility, suspended/deleted accounts, session revocation, no token leakage, enumeration-safe account recovery/email-change responses; rate limits not represented as distributed when only in memory.
- **KYC:** only trusted provider-backed APPROVED state may authorize real-world hosting/join/meeting; recheck expiry/revocation wherever those rules are meant to apply; virtual activity exemption stays intact. Do not invent provider responses.
- **Visibility/blocks:** profile/discovery, avatar, follow, wave, DM, group previews/posts/chat, activity details and notification/home projections must not leak blocked or unauthorized data. Test 404 masking where documented.
- **Transactions/concurrency:** activity last seat and FIFO waitlist, membership capacity/ownership transfer, DM request race and canonical conversation uniqueness, idempotent message sends and notification deduplication. Do not weaken atomic transactions or force 409 when both serializable updates are valid.
- **Uploads/media:** byte-level validation, path containment, ownership, private access, abandoned-file risk, fail-safe disablement for D-06 media. No production local-disk assumption. Do not physically purge existing media as part of this task.
- **Commerce/jobs:** no order/pay/upgrade routes, cart uses server-side pricing, no false employer-delivered status, published-only public visibility, user-owned drafts/applications.
- **Member entitlements:** BASIC is accurate, `CLUB` entitlement denied, KYC is independent, and existing features are not restricted by unapproved premium limits.

Prioritize **regression tests and narrow bug fixes**, not broad speculative rewrites. Verify negative/unauthorized cases and use the existing error-envelope convention. If a gap needs a new product policy, record the precise blocker and keep behavior fail-closed.

## Step 4 — Operational safeguards possible without a vendor decision

- Validate required production env/config at startup and reject unsafe dev-only features in production; do not silently start in an insecure configuration.
- Check health/readiness behavior and error handling for unavailable DB or storage. Avoid disclosing internal connection details.
- Identify single-instance rate limiter, dev email delivery, production KYC, cloud media, Stories cleanup, consent version identifiers, and webhook/billing as **external/owner-gated blockers**; do not mark them resolved by placeholders.
- Where safe and small, strengthen diagnostics/log redaction, integration guardrails, idempotency, and documented maintenance scripts. Do not create recurring production jobs without approval.

## Step 5 — Keep API and client contracts truthful

Update only affected files among:

- `docs/api/CURRENT_APIS.md`
- `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`
- corresponding `openapi/*.yaml`
- `docs/plans/STATUS.md`, `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md`
- `docs/product/OPEN_QUESTIONS.md`

Always distinguish **implemented**, **integration-verified**, **DEV_ONLY**, **disabled**, **provisional policy**, and **release-blocked**. No Flutter code or promise of E2EE, KYC approval, paid benefits, delivered employer applications, verified merchants or active subscriptions.

## Explicit exclusions

No D-06 flag activation; no Stories public Home activation; no Stripe/mobile IAP or store checkout; no Club subscriptions/trials/entitlements; no irreversible account deletion; no production email/KYC vendor hookup without credentials, owner choice and policy; no production infrastructure deployment; no synthetic seeds that imply real products, jobs or paying members. Preserve Tasks 006–017 and previously approved policies.

## Deliverables / acceptance

1. A concise list of **actual code/test/config improvements** made in Task 018, with paths.
2. Security regression coverage added and specific bugs fixed (if found), including unauthorized and concurrency cases.
3. Actual results for Prisma validation, generation, typecheck, lint, unit, build, isolated Neon integration; include totals and the known intentional skip.
4. Formatting report: line-ending-only count, substantive violations, files changed, and honest global `format:check` status. No fabricated green.
5. Non-destructive migration verification and DB isolation evidence (no secrets).
6. Exact remaining **owner decision** vs **external integration** vs **engineering defect** blockers. Do not call backend production-ready until launch gates are actually satisfied.
7. No commits, pushes, Flutter changes or production actions. Return one complete engineering report and recommend the next highest-value implementable milestone.

## Cursor execution note

Act now: inspect → implement narrow fixes/tests → run all gates → report. Do not start another general architecture-only planning task. If provider/policy input is missing, continue with all independently safe work and document the remaining owner dependency precisely.
