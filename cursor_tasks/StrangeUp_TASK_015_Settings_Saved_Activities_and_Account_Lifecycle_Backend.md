# StrangeUp — TASK 015: Settings, Saved Activities & Secure Account Lifecycle (Backend)

**Mission:** Deliver one substantive, Figma-backed BACKEND-only milestone on the existing StrangeUp API. Implement supported settings/account-management functionality now; do not make destructive account deletion, email transport, 2FA, subscription, billing, KYC provider, or invitation features appear LIVE without their actual security/policy dependencies. Avoid a documentation-only task.

**Current baseline (owner-shared Task 014 engineering report; not independently re-run here):** Prisma 7, Express/TypeScript, isolated Neon `strangeup_dev` / `strangeup_test`; Task 014 reports 140 unit tests passed (33 files), 80 integration tests passed, 1 intentional placeholder skipped (11 files), plus migrations applied to both DBs. `format:check` has reported pre-existing Windows CRLF warnings. Tasks 006–014 must be preserved. No commits or pushes.

## 0. Source of truth and verified Figma boundaries

Read `AGENTS.md`, `.cursor/rules/*`, `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`, current Prisma models/migrations and open decisions before modifications. Open **original** `Screen 26_ Profile & Settings.pdf` in `Strange up(1).zip` and compare with actually available API implementations. Use visual rendering where possible. The settings hub **visibly includes**:

- User header, avatar, profile link, and illustrative ID Verified / Club Member / meetups / groups / rating counts;
- Edit Profile, Personal Information (email, phone, DOB), Change Password & Security;
- My Activities, Saved Activities, My Groups, Meetup invites, Jobs;
- Subscription, Payment History;
- Identity Verification, Blocked Users, Privacy & Permissions;
- Help Center / FAQs, Contact Support, Community Guidelines;
- Log Out and Delete Account.

**Do not infer** that detailed screens, 2FA, phone verification, active subscription, billing invoices, actual deletion flow, support SLA, verified badge, precise meetup sharing, ratings or counts are live simply because Screen 26 uses example/mock copy. Reuse the implemented Tasks 005–014 endpoints rather than producing duplicate business logic. `Screen 18_ Membership Plans.pdf` may be consulted only to report membership/billing as deferred.

## 1. Deliver independently supportable Settings APIs

Implement a compact authenticated settings-summary endpoint under a consistent route (proposed `GET /v1/me/settings/overview`) that **aggregates only true, already persisted state**. Examples: own profile name/avatar presence, current verified email/account state, authoritative identity-verification status *without inventing approval*, current visibility setting, hosted upcoming activity count, confirmed RSVP count, saved-activity count (if implemented below), group active membership count, actual blocked-user count, saved jobs / own job applications as appropriate, available session-security capabilities.

- Count queries must be privacy-safe, bounded and accurately scoped; don't query all lists and count them in memory when aggregate queries exist.
- Explicitly return `UNAVAILABLE`/`DEFERRED` or omit mock fields for actual 2FA, subscription, renewal date, payment history, ratings, invites, 24/7 support and any other nonexistent system. **Never** return a fake zero as if an unavailable feature were implemented, or a badge purely based on sample Figma values.
- `GET /v1/me/account`, `GET/PATCH /v1/me/profile`, existing password-change, blocks, groups, hosted activities, RSVPs, messaging, job applications and logout APIs already exist: **link/reuse** them; do not duplicate their domain models.
- For phone: inspect real persisted phone and its verified/unverified semantics; don't add an unverified write/verification path unless explicitly approved. DOB and KYC remain non-self-editable under existing policy.

## 2. Saved Activities — complete the visible missing self-service feature

Implement saved/favorited **real Activity entities**, independent of Task 008's plain-text `FavoriteActivities` preference pins, Task 010 RSVPs, and Task 012 group-activity links. Proposed API following repo conventions:

- `GET /v1/me/saved-activities?cursor=&limit=`: authenticated eligible user's saved activities (bounded, cursor-stable, public-safe fields only); handle cancelled/unpublished/blocked-host activities without exposing details. A safe omission plus clear documentation is acceptable.
- `PUT /v1/me/saved-activities/:activityId`: idempotent save for an eligible, currently public, published Activity, no KYC requirement for simply saving; no RSVP or group membership side-effect.
- `DELETE /v1/me/saved-activities/:activityId`: idempotent remove of own association without leaking private target existence.

Prisma: additive `SavedActivity` join model or consistent existing naming; unique `(userId, activityId)`, FKs/indexes and clear cascade on user/activity deletion, if genuinely compatible with current schema. No invented content or seeded saves. Test different users, blocked hosts, stale/past/cancelled activities, duplicate concurrent save, pagination and user-data isolation. Saving cannot expose private meeting instructions.

## 3. Email change — secure two-phase lifecycle; no fake transport

Review existing identity, scrypt hashing, verified email, token challenge, session invalidation, and real/current email transport implementation. If current infrastructure permits the approved safe behavior, implement a **two-phase email-change verification** with minimal reuse of existing auth components; otherwise implement only safe server foundations and mark externally dependent steps explicitly blocked.

Recommended API names only if consistent with existing route conventions:

- `POST /v1/me/email-change/request`: verified eligible session plus fresh credential confirmation (current password for password accounts), normalized candidate email uniqueness, anti-enumeration where appropriate, rate limiting; issue short-lived single-use hashed token/challenge for the **new email address**; old email stays authoritative until confirmed. No email update on request alone.
- `POST /v1/me/email-change/confirm`: verify challenge expiry, token hash, recipient binding, replay/race prevention; transactionally swap verified email and resolve related sessions, refresh tokens and verification records according to security policy; notify prior email when a *real* notification transport exists. Decide (and document) whether refresh sessions are revoked; prefer cautious revocation and clear API client re-login instructions.

Do not expose challenge/token in production responses or logs. The existing email delivery may be DEV_ONLY; if no verified email sender, mark feature **DEV_ONLY / NOT PRODUCTION-READY**, never claim users receive real email. Avoid an account-takeover path for sessions without password-based recent reauthentication, OAuth-only identities, or pending accounts. **Never** change the established login identifier without actual proof of control of the new address.

If email-change policy/transport assumptions are not already approved, record them in the single consolidated owner-decision batch and implement only the safe independent server components; don't invent owner approval.

## 4. Security sessions and logout

Verify existing refresh/session registry and current logout/logout-all routes. If session records can reliably identify sessions and revoke just one session, implement:

- `GET /v1/me/security/sessions` — own bounded active sessions, non-secret metadata only (`sessionId`, created/last-used if actually persisted, isCurrent if reliably derivable). **Never** JWTs, raw refresh tokens, IP location guesses, fingerprints or authentication secrets.
- `DELETE /v1/me/security/sessions/:sessionId` — user-owned session revocation, idempotent, suitable error and self-authorization checks. Document current-session effects.

Otherwise extend existing tested logout-all only, and mark per-device session controls as deferred. **Do not fabricate** 2FA activation or an authenticated device list from imaginary records. If adding metadata requires sensitive retention decisions, keep it minimal and explicit.

## 5. Delete Account — account-wide, irreversible policy gate

**IMPORTANT: Not authorized to execute a destructive user deletion just because a Figma hub has a Delete Account entry.** The current User graph connects to profiles, media, messages and DMs, groups, group ownership, posts, Activity hosting/RSVP, notifications, follows, jobs/applications and carts. Blanket Prisma cascade or `DELETE FROM User` may destroy third-party content or violate promised data retention.

- Do an implementation-minded dependency inventory of current Prisma relations/cascades, orphaned disk media, pending hosted activity, group ownership, direct-message threads, personal vs shared content, job applications and notifications. Keep it bounded and actionable (one matrix, not a new architecture milestone).
- Build safe, independently useful `GET /v1/me/account-deletion/impact` **only if** it can be guaranteed self-scoped and avoids exposing other users' private information. Return actual counts/dependency types and `deletion.status: 'AWAITING_POLICY'` (or consistent explicit enum), not a false confirmation; otherwise simply document current unavailability in Settings overview.
- **Do not** implement or expose a live destructive delete endpoint, automatic scheduling, silent account deactivation, cascaded media erasure or one-click delete until owner approves retention periods, cooling-off/recovery, child/dependent resources, host/group ownership disposition, legal hold/audit obligations, payment/job records, notifications, and password/reauth confirmation. Do not invent compliance claims.
- Once a future owner approval explicitly authorizes deletion, implement/verify a carefully scoped lifecycle with reauthentication, abuse controls, idempotence, job cleanup, media cleanup and complete cross-module regression. Not in this task without such approval.

## 6. Policy decisions — ONE concise consolidated owner table, not a separate documentation-only task

Keep unapproved assumptions **PROVISIONAL** and continue implementing safe independent features. Report recommended defaults and exact required decisions for:

- `SET-01`: Email change reauthentication, pending challenge window, old-email notification, existing session revocation, handling account types without passwords; production sender still deferred.
- `SET-02`: Session inventory granularity and retention; only what can be grounded in existing records.
- `SET-03`: Account deletion vs deactivation; grace period, full account graph & third-party messages/posts, groups ownership, public content, jobs/applications, private media and backups, legal holds, notification/email disclosure.
- `SET-04`: Phone edit/verification if no trusted phone verification transport; DOB noneditable.
- `SET-05`: Support/legal content sources/links, 2FA, membership and billing — show only configured actual capabilities.
- Previously open D-06 Groups/Stories, Task 011 social defaults, MKT-01..04, JOB-01..03, D-18 retention, consent canonical versions stay OPEN unless owner separately approved. **Never** auto-sign off based on implemented provisional code.

## 7. Security, migrations & verification

- Preserve authenticated active, age-eligible and email-verified gates as appropriate; `canAccessAccount` where read-only owner state is intentionally accessible to pending accounts; don't indiscriminately apply `hasFullAccountAccess` to security recovery paths if it would lock legitimate users out.
- All operations self-scoped; validate UUID/idempotency; avoid leaking account existence, emails, KYC details or blocked profiles; always re-evaluate blocked and visibility status on joins; use strict Zod request allowlists and existing envelope and `AppError` conventions.
- New Prisma changes **forward-only and additive**; old migrations unchanged. Use existing Neon direct/migration config and guard: `strangeup_dev` for normal development, `strangeup_test` for integration. Inspect/restrict identity before any integration cleanup; do not drop/reset databases or run unsafe raw truncates outside guarded test fixtures. Do not expose DB URLs/secrets.
- Unit: settings summary classification and fallback states, saved-activity validation/private filtering, email-change token expiry/replay/recipient and uniqueness, session ownership/revocation, deletion-impact DTO safety and permission checks.
- Integration: cross-account isolation, account state gates, repeated saves, saved vs RSVP distinctness, hidden/blocked host leak prevention, correct actual counts, email change unverified-old-address behavior, invalid/reused/expired challenges, concurrent confirm, session invalidation correctness, no fake 2FA/subscriptions/deletion. Run existing Tasks 006–014 regression once at section closure. Distinguish test fixtures from production transport.
- Run `prisma:validate`, `prisma:generate`, `typecheck`, `lint`, `format:check`, `npm test`, `build`, `RUN_INTEGRATION=1 npm run test:integration`; report exact counts and intentional skips. Address Windows CRLF formatting with narrow fix or tracked separate work, not repository-wide unrelated rewrites.

## 8. API documentation and final handoff

Update `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` (Settings section), relevant `openapi/*.yaml` (e.g. `openapi/settings.yaml`), `docs/plans/STATUS.md`, `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md`, `docs/product/OPEN_QUESTIONS.md`, and Figma parity (`Screen 26`). Each route must explicitly state LIVE / DEV_ONLY / DEFERRED, gates, request and response shape, status/errors, side effects, and safe empty/unavailable states. Tell Flutter team not to show sample verification, payment history, renewals, 2FA, support guarantees or deletion success as real features.

**Report:** exact source/migrations/routes; successful and skipped unit/integration tests; actual Neon evidence; security/ownership findings; completed vs deferred Screen 26 controls; owner decisions that genuinely require approval; existing open product decisions; git status; next recommended Figma section. No Flutter source changes, production changes, real user deletion, commits, pushes or destructive DB operations.
