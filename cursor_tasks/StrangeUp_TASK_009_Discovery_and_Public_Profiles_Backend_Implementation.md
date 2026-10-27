# StrangeUp — TASK 009: Discovery & Public Profiles (BACKEND Implementation)

**Status:** OWNER APPROVED — implement now (not a documentation-only task)
**Date:** 2026-10-27
**Stack:** Node.js / TypeScript / Express / Prisma / PostgreSQL
**Repository:** `strangeup-backend` only; Flutter is a separate repository/team.
**Owner policy approvals:** D-03 Public Profile/Visibility MVP and D-04 Location/Discovery MVP, expressly approved 2026-10-27.
**Dependency context:** Tasks 006–008A Own Profile implemented; native PostgreSQL migration and integration verification remain blocked until owner supplies working local credentials. Continue coding without requiring that gate to be closed now.

## Executive instruction to Cursor

**Implement a complete, secure MVP of People Discovery and other-user Public Profiles in the current backend.** Follow the approved policy below. Inspect existing source and decisions first, reuse existing Auth, Account, Profile, Interests, media and policy helpers, and do not rebuild completed features. Deliver code, additive migrations if needed, targeted unit tests, DB-dependent integration tests written, synchronized API contracts for the separate Flutter team, and a concise evidence-based report. Do not stop for another planning/documentation milestone. No unrelated features or production work.

## A. Owner-approved product policy — treat as final for MVP

1. **Discoverer/viewer eligibility:** authenticated, session-valid, active, non-suspended/non-deleted, email-verified, age-eligible adult (`ageEligibilityStatus === ELIGIBLE`). Reuse existing server-side eligibility policy and meanings, rather than creating an inconsistent duplicate.
2. **Target eligibility:** only eligible, active, email-verified, age-eligible accounts can appear in discovery or be accessed as public profiles. Never expose pending, suspended, deleted, otherwise ineligible accounts; no automatic KYC requirement for target accounts choosing `EVERYONE`.
3. **`Profile.profileVisibility = EVERYONE`:** visible to eligible authenticated users; NEVER implies unauthenticated/public-web access.
4. **`Profile.profileVisibility = VERIFIED_USERS_ONLY`:** visible only to eligible viewers with a **current server-trusted government-ID KYC `APPROVED` status**. Email verification, badges, JWT claims supplied by the client, KYC initiated/pending, expired/revoked/failed statuses are NOT equivalent to approval. Check the existing authoritative server-side KYC state on each request. If no trustworthy KYC approval state is available, deny access to these profiles (fail closed); DO NOT mock approvals or integrate a new vendor here.
5. **Default visibility:** retain approved default `VERIFIED_USERS_ONLY` for newly created profiles (Task 008A); do not rewrite existing users' explicit or historical visibility values. Self-service `GET/PATCH /v1/me/profile` remain intact. No hidden automatic changes to choices.
6. **Location:** only self-reported optional `locationCity`, `locationRegion` already stored on Profile (max 80 chars each). Expose them **only after** viewer eligibility, profile-visibility, and block checks. Do not invent verified-location status, proximity, geocoding, precise coordinates, distances, radius filtering, maps or distance ranking. Null/empty location yields no location claim.
7. **Public profile fields (strict allowlist):** stable user ID, suitable existing display name/username, bio, permitted avatar presence/authorized fetch link, selected catalog interests (slug/label), and optionally city/region. If the existing schema supports safe member-since information, include it only if necessary and documented; otherwise omit. Do NOT expose email, phone, birth date, age (requires separate approval), account/verification internals, raw KYC evidence/status, location verification, timezone, private favorite-activity preferences, media storage keys/paths, sessions or PII. Public DTOs must be constructed explicitly, not by forwarding Prisma User/Profile records.
8. **Blocking:** if either viewer has blocked target OR target has blocked viewer, the profile must not be visible and must not appear in discovery. Enforce in the data-layer query and at detail/media fetch time; no counts, error text or cursor metadata should reveal hidden/blocked accounts. Implement the minimum real, persisted block controls if missing (see section D). No stubbed block check.
9. **Disallowed/unapproved Figma UI functions:** Do NOT implement or imply live map, distances/Within 5 miles/Nearest first, verified badge without trusted KYC, recent online/active status, follower/review/meetup counts, shared meetups, Follow, Wave, Message, chat, group/activity feeds, join/RSVP/host, or activity discovery in this task. Those appear in screens but belong to later approved modules. No fake demo data in production endpoints.
10. **Activity Discovery (`Screen 11`) is a separate backend domain.** Read the Figma for context but do not create activity APIs, activities tables, RSVP or KYC joining workflows in Task 009.

## B. Grounding in the actual original Figma export

Inspect the **actual PDFs**, not guessed screen identifiers:
- `Screen 09_ Discover/Nearby People.pdf`: people list/cards, search, View Profile, privacy-sensitive map/radius/distance/age/verified/activity/presence elements. **Implement eligible people list + search + navigation via IDs only**; leave unsupported widgets deferred.
- `Screen 10_ User Profile.pdf`: display identity, avatar, bio, interests, city, Follow/Message/Wave, activity/group/followers/ratings/ID verified mock elements. **Implement an approved minimal public-profile DTO and protected avatar**; no invented social metrics or social actions.
- `Screen 08_ Home Dashboard.pdf`: preview of people near you. Existing dashboard is NOT authorized to expose hidden profiles. Document that future dashboard people cards must reuse the same access service/filter.
- `Screen 11_ Activity Discovery.pdf`: separate upcoming section; not implemented under People Discovery.
- `Html → Body-1.pdf`: private own-profile edit inputs created in Tasks 006–008A, not authorization for public exposure of all fields.

If any screenshot control conflicts with approved D-03/D-04, **owner policy wins**. Surface specific Flutter-design discrepancies in the handoff, but do not change Flutter code.

## C. Implement the public read surfaces

Use repository naming/routing patterns; intended canonical MVP routes:

### `GET /v1/discover/people`
- Bearer-authenticated, eligible viewer only.
- Returns a **bounded, paginated** list of candidates the viewer is authorized to see under EVERYONE / VERIFIED_USERS_ONLY and bidirectional block rules.
- Exclude self, inactive/pending/suspended/deleted/underage targets and blocked relationships.
- Useful **non-geospatial** filters: optional text query across existing public `displayName`/`username`, optional exact normalized city and region, optional **approved catalog interest slug**. Filtering/searching must not bypass visibility/access rules. If the approved existing schema or code cannot support a filter cheaply and safely, implement the basic list first and explicitly defer that filter; do not add a geo engine.
- Use stable deterministic order with a tie-breaker and an opaque cursor (or existing cursor-page convention), a safe default limit and hard upper bound; document the exact parameter names. No misleading “nearest”, current online ranking or fabricated match score; do not return exact total counts that might include hidden accounts. Avoid unbounded scans, accidental N+1 queries, or leaking hidden records through cursor advancement.
- Response: only the approved public-preview allowlist, e.g. `data.people`, `meta.nextCursor` within the existing API envelope; match repository's current envelope and metadata conventions instead of inventing a second system. Any preview must be re-authorized on detail/avatar request.

### `GET /v1/users/:userId`
- Server-validated path identifier using existing canonical User ID form.
- Check viewer eligibility, target eligibility, bidirectional blocks and visibility **before** constructing an explicit public DTO.
- For nonexistent, blocked, hidden or ineligible targets, return the **same generic 404** response. No distinguishing `403` or existence/status-specific message after viewer authentication; auth/eligibility failures for the VIEWER still use current standard `401/403`.
- Fetch interests via Task 007 catalog relationship; honor catalog `sortOrder` consistently. Never expose private favorite-activity pins or raw personal/location/account data.
- A self-ID request may use this public projection only if consistently authorized; own private details remain through `/v1/me/profile`.

### `GET /v1/users/:userId/avatar`
- Reuse the existing private Task 008A image processing/storage helpers; **do not** reveal the local disk path or make `PROFILE_UPLOAD_DIR` static/public.
- Re-check the same viewer/target/block/visibility authorization immediately before serving, including changed visibility and revoked KYC. A preview/avatar URL is not an authorization grant.
- Serve only sanitized stored image bytes, with correct content-type, safe content disposition and privacy-appropriate cache-control (`private, no-store` or stricter where appropriate). No public CDN URL until production media policy is approved.
- Return generic not-found behavior for absent/hidden files; do not expose filesystem traces or internal keys. Respect the previously documented orphan-file limitation without worsening it.
- If there is an existing secure media gateway, use it instead of duplicating storage logic.

## D. Minimal real blocking persistence and endpoints (only if absent)

Blocking is an approved, non-optional enforcement requirement for Discovery. Inspect the current schema/routes FIRST. If robust block relations and controls already exist, reuse them without creating duplicates. Otherwise implement a narrow `UserBlock`/equivalent with `(blockerId, blockedId)` unique composite key, server timestamps, FK references and appropriate cascade on future user deletion; add an additive Prisma migration. Forbid self-blocks; make block/unblock idempotent and scoped to authenticated actor identity. No user-supplied blockerId.

Expected self-management controls, subject to existing naming conventions:
- `POST /v1/me/blocks` with `{ "targetUserId": "<id>" }`: block target; repeat safe.
- `DELETE /v1/me/blocks/:targetUserId`: unblock target; repeat safe.
- `GET /v1/me/blocks`: optional bounded/paginated self-only list of blocked **IDs/timestamps** for Settings/Blocked Users; do not expose blocked person's hidden public DTO merely via this list.

Document the final chosen route names and precise response/error envelopes. Validate IDs and errors. Apply bidirectional block checks in all new discover/detail/avatar reads, not just listing. If blocking or eligibility state changes between list and detail, the latter must deny correctly. Do NOT assume this task implements Follow/Wave/Chat blocking effects—those future modules must call the shared policy.

## E. Authorization & query architecture

- Build/reuse one **shared and testable** visibility policy (`canViewPublicProfile(viewer,target)`) covering existing KYC policy and bidirectional blocks. Apply equivalent constraints in list query **at DB level** and re-check detail/media. Avoid read filters based solely on client-supplied flags.
- For KYC, prefer a server-trusted current status from existing owner-approved structures. Provider not yet selected; **never create an admin/test bypass in production**, accept user-supplied KYC status, or grant KYC approval from email verification.
- Handle invalid IDs, missing targets, hidden profiles and rapid policy changes safely; use transaction/consistency patterns where needed, don't claim perfect atomicity across network/file reads.
- Guard user-supplied text/filters and query parameters; use Prisma parameterization, bounded pagination, no raw interpolated SQL, reasonable indexes and query plans. Avoid log exposure of PII/location.
- Rate-limit discovery/detail lookups under existing infrastructure where possible; note current single-instance rate-limit limitation if still present.
- Avoid exposing online presence, raw coordinates or third-party service data. Profile visibility applies **regardless of link navigation**, including media and future dashboard reuse.

## F. Testing and verification: efficient section-based workflow

**During coding, run** `prisma validate/generate`, typecheck, lint, formatting, build, and focused unit tests. Write DB-based integration tests now, but **do not repeatedly troubleshoot Prisma Dev**. Native `localhost:5432` remains credential-blocked in this workspace until the owner supplies a real password. Do NOT hard-code it, ask to paste it in chat, reset databases, or pretend integration passed.

Required tests/fixtures (follow existing test framework):
1. Eligible viewer sees target set to EVERYONE; unauthenticated and ineligible viewers denied.
2. Target with default `VERIFIED_USERS_ONLY` hidden from email-verified-only viewer, visible only to **trustworthy current KYC APPROVED** viewer; pending, expired, revoked, failed, missing KYC all denied.
3. `EVERYONE` does NOT mean anonymous public access.
4. Target suspended/deleted/pending/unverified/ineligible never appears or yields a public detail.
5. Both directions of block eliminate discovery, direct user profile and avatar; unblocking restores only if all other rules pass; self-block rejected and duplicate request safe.
6. Generic 404 for nonexistent, blocked and hidden direct profile/avatar; no hidden details/counts leaked through query filters/pagination.
7. Public DTO field allowlist: ensure no birthDate, email, phone, KYC evidence/state, account flags, sessions, media key/path, private favorite activities or timezone.
8. Optional city/region exposure only for authorized viewers, no false verified badge/coords/distance; clearing to null updates exposure.
9. Avatar route denies immediately after visibility changes/block/KYC revocation; bytes sanitized; no static/media path bypass.
10. Search/filter validation, cursor ordering, limits, cross-user isolation, empty pages and idempotent block controls.
11. Existing auth/profile/interests/avatar regressions unchanged; no synthetic KYC approvals outside isolated test fixtures.

When native PG credentials become available, perform migrations safely against both **separate** dev/test DBs, confirm DB identities, then run full profile + discovery integration regressions. Keep **Own Profile = IMPLEMENTED, INTEGRATION VERIFICATION PENDING** until that happens. Discovery likewise = IMPLEMENTED, INTEGRATION VERIFICATION PENDING until real DB tests pass. Do not mark as fully verified based on unit tests or fixtures alone. Respect the existing integration guard and do not truncate development/production data.

## G. Docs and separate Flutter-team handoff (part of implementation, not separate task)

Update in the same coding milestone:
- `docs/decisions/` D-03/D-04 owner-approved MVP rules (brief record; no new decision requests).
- `docs/api/CURRENT_APIS.md`: exact implemented endpoints, auth matrix, DTO allowlists, filter/pagination/404 behavior and honest LIVE-in-source vs DB-verified status.
- `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`: exact list/search/view/profile-photo request/response examples; authorization, `VERIFIED_USERS_ONLY` implications with deferred KYC provider; no distances/map/presence/Follow/Wave/Message and how to hide/disable unsupported controls; dynamic removal on block/visibility changes.
- appropriate `openapi/*.yaml` (reuse identity.yaml if that is current repository convention).
- `docs/plans/STATUS.md`, `ACTIVE_SCOPE_AND_DEFERRALS.md`, `docs/product/OPEN_QUESTIONS.md` (record approvals and deferrals, no new approval requests), and Figma parity / screen traceability.
- New block endpoints in Flutter handoff for `Screen 26` settings as applicable; Flutter implementation is a separate team's responsibility.

## H. Mandatory scope exclusions & safety

- **BACKEND ONLY.** No Flutter code/repository, no Figma design edits, no front-end UI generation.
- No official KYC provider, Stripe, OAuth, real email vendor, chat, presence, Follow/Wave, reviews, follower counts, activity/RSVP/hosting, maps/geolocation, ranking by miles, map coordinates, or real-time push in this task.
- Preserve approved KYC real-world activity restrictions for future Activities: host/join/RSVP gates cannot be weakened by a viewer's public profile visibility.
- Do NOT label all users `ID Verified`; KYC is not universally required for signup/browsing. Do not claim E2EE is operational unless implemented/verified.
- No committing, pushing, destructive migration/database resets, manual production access, or changing native PostgreSQL credentials.
- No broad architecture rewrite. Prefer incremental, testable changes with exact file paths and minimal diff.

## I. Deliverables / completion report

Return one actionable engineering report with:
1. New/modified source & migration files and any existing modules reused.
2. Exact endpoints (method, path, auth, DTO, pagination, 401/403/404/400) implemented.
3. Evidence that KYC-approved-only visibility and blocked-both-directions are enforced at list, detail, avatar; target and viewer eligibility; strict public DTO.
4. What Figma elements are implemented vs intentionally deferred (distance, map, online status, verified badge, social actions, activities).
5. Quality gate counts (actual run output); unit/integration tests authored, run, skipped and blocked; **no false pass claims**.
6. Migration/db state and confirmation original Task 006–008A Profile verification remains pending until native PostgreSQL credentials are resolved.
7. Outstanding non-blocking implementation risks and next practical section (Social Connections/Follow/Wave vs Activities) without beginning a new module here.

**Start implementing now; no additional documentation-only task and no discretionary approval gate.**
