# StrangeUp — Task 016: Community Stories, Photo Posts & Polls (BACKEND)

**Task type:** One substantial Figma-backed implementation milestone, not a documentation task.  
**Stack:** Node.js, TypeScript, Express, Prisma 7, PostgreSQL on existing isolated Neon dev/test databases.  
**Starting evidence (Cursor's Task 015 report, 2026-10-27):** `npm test` **148 passed / 36 files**; full `RUN_INTEGRATION=1 npm run test:integration` **87 passed, 1 intentional skipped / 12 files**; `20261027230000_saved_activities_settings` applied to Neon `strangeup_dev` and `strangeup_test`. These are report claims: inspect current repository before stating they remain true. Tasks 006–015 exist and must be preserved.  
**Owner-policy gate:** **D-06 is OPEN**. Implementation may proceed on independently supportable foundations, but **do not enable community Story/photo/poll publication, public-media reads or pretend full Figma parity is LIVE** until the relevant owner behavior and exposure rules are explicitly approved. Do not infer policy approval from this implementation task.

## Mission

Build a maintainable, secure **group media & interactive-content backend slice** on top of Task 012 `CommunityGroup`, `CommunityMembership`, `CommunityPost`, posts/likes/comments/moderation and Task 013 Home/community-feed composition, reusing Task 008A Sharp-based image handling. Implement bounded Story expiration/read-time rules, member-authorized group photo attachments, and group polls/votes where safe and technically supportable, plus necessary media/reporting safety. Keep activation of unresolved product-policy behaviors disabled by default until D-06 approval; don't stop at diagrams or another documentation-only task. Return one engineering report with implemented functionality, exact activation state, tests and a compact D-06 decision table.

### Actual original Figma evidence — inspect directly before coding

- `Screen 15_ Group Details — Stories, Chat & Meetups Update.pdf`: Group Details header, Posts / Stories / Chat / Meetups / Members tabs and post-composer actions **Photo, Activity, Poll, Post**. Post cards contain illustrative photography, like/comment/share and pinned announcement. Does **not** provide a complete Story authoring, poll vote, reporting or moderation flow.
- `Screen 08_ Home Dashboard — Community & Stories Update.pdf`: `COMMUNITY STORIES`, `24h Disappearing`, `Your Story`, named community Story circles; joined-group feed examples. **Do not assume 'Your Story' is already defined as a personal Story entity**. Personal/profile Stories vs group/community Stories require an explicit separate owner decision.
- `Screen 15_ Group Details/Community.pdf`, `Screen 14_ Groups.pdf`, `Screen 1_ Create Group.pdf`, `Screen 2_ Manage Group Dashboard.pdf`: existing group membership and moderator/owner assumptions.
- `Screen 26_ Profile & Settings.pdf`: privacy, blocked users; do not treat hub navigation as approval for media exposure.

Find the PDFs in the existing project ZIP (`Strange up(1).zip`) or existing design-reference path. Quote exact verified controls; do not claim non-rendered interactions or imaginary story detail screens.

## Hard constraints

1. **BACKEND ONLY.** No Flutter work, production actions, commits, pushes, vendor purchases, account deletion, destructive migration/reset, rewriting previously applied migrations or changing Stripe/KYC integrations.
2. D-02/D-03/D-04: authenticated active, age-eligible and email-verified account gates; viewer visibility and bidirectional blocks are enforced against current state. Government ID KYC is **not** required for ordinary community media, but Tasks 010 real-world activity RSVP/hosting/meeting details still require trusted KYC and no group/post/story access can bypass it.
3. D-06 is **provisional**. Until explicit approval, feature capabilities and public-facing routes should remain **not enabled** by default, or limited to an auditable owner-safe staged/draft implementation. Never return success claiming a publicly viewable Story when the publication flow is disabled. Tests may enable a clearly isolated test-only gate to verify actual behavior; this is not a production bypass.
4. Do not imply E2EE, real-time presence, verified community, audience counts, views, external moderation, push delivery, or automated 24h file erasure without real implementation.
5. Media stored on local disk is **DEV_ONLY**, not production-ready object/CDN storage. File cleanup across filesystem and PostgreSQL is not atomic; document and test fallback/reconciliation.
6. Preserve existing Task 012 posts and Task 013 feeds: do not create a parallel social-post model or duplicate comments/likes for photo posts. Don't widen private group media availability to anonymous/nonmember users.
7. Keep `docs/api/CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md` and OpenAPI precise: **LIVE & VERIFIED**, **IMPLEMENTED BUT DISABLED**, **DEV_ONLY**, **DEFERRED**, **PROVISIONAL** are materially different.

## 0. Repo and policy inspection (short, then code)

- Read `AGENTS.md`, `.cursor/rules/*`, `STATUS.md`, `ACTIVE_SCOPE_AND_DEFERRALS.md`, `OPEN_QUESTIONS.md`, D-03/D-04 decisions, `D-GROUPS-TASK012.md`, D-06, Task 011 provisional consent/block rules, Tasks 012–013 group/feed DTOs and authorization, Task 008A media pipeline and storage, `docs/api/CURRENT_APIS.md`, `openapi/groups.yaml` and `home.yaml`.
- Before editing, inspect `CommunityPost`/`CommunityMembership` constraints and groups services, existing media cleanup, activity link access and Home `stories: { status: 'DEFERRED' }`. Reuse code; avoid duplicate group membership truth or per-author privacy logic.
- Implement genuinely useful functionality now; record only the **small necessary** policy decisions as provisional. Do not stop and ask the owner repeated minor questions.

## 1. Safe media foundation (required)

- Add a narrowly scoped group-media processor/storage adapter reusing existing **Sharp** content decoding/format verification and sanitization. Accept only valid JPEG, PNG, WebP **bytes**; reject SVG, spoofed MIME, polyglot/invalid images, unsafe sizes, decompression bombs and path traversal; 5 MiB request limit and reasonable input/output pixel caps matching or stricter than existing avatar/cover processing. Re-encode/strip EXIF/GPS. Do not trust client filenames or client-provided media URLs.
- Store with UUID/opaque keys under a trusted configured group-media root outside public static roots; never use unvalidated group IDs as raw filenames or leak filesystem paths in public DTOs. Stream access through member/visibility and block authorization. Write via staging; atomically commit metadata where possible, roll back/discard staged file on DB failure, delete replaced/removed blobs best-effort and log orphan cleanup without sensitive metadata. Prevent symlink escape or ownership confusion.
- Use metadata model(s) with owner group, post/story association, content-type, file key, lifecycle state, createdAt, expiresAt when relevant; bounded indices. Include an operational cleanup command/job that is **safe to invoke manually**, dry-run and nonproduction defaults; don't claim cron/background scheduling is live unless it actually exists. Do not delete other groups' files even if identifiers are tampered.
- Avoid broad upload endpoints that publish unmoderated bytes to everyone. Make unauthorized/expired/removed reads indistinguishable (`404`) where this matches existing policies.

## 2. Photo attachments on existing group posts

- Add optional validated 0..N bounded photos on existing `CommunityPost` rather than a second post table; recommended conservative MVP **one image per post** initially unless repository or approved spec already supports more. It can be added to an eligible member's own post or a member-safe creation flow, with moderators' existing removal privileges. Prevent adding media to a post in a group the user no longer belongs to or to a moderated/deleted post.
- Reuse current text post, pinned, comments, likes and feed projection; photo posts carry only protected media IDs/authorized media URLs, never raw storage keys. Task 013 Home/community feed should show media **only if enabled and authorized** and not silently imply images where none exist.
- Clearly distinguish internal STAGED/PRIVATE media from accessible media; until D-06 photo-publication policy is approved, keep newly created photo attachments off public/member-visible feed or fail closed. No arbitrary third-party CDN URLs, remote image fetches or outbound network SSRF surfaces.
- Proposed routes only if consistent with current conventions: `POST /v1/groups/:groupId/posts/:postId/media` (multipart `image`), `GET /v1/groups/:groupId/posts/:postId/media/:mediaId`, `DELETE .../media/:mediaId`. Auth by current group membership + owner/mod roles and current blocked-author content policy. Do **not** describe a route as LIVE until actually reachable, permitted and tested.

## 3. 24-hour group Stories foundation (owner-gated activation)

- Implement a cohesive group-Story model and service, separated from direct messages and activity records. Fields: groupId, authorId, media reference, server-created `createdAt`, deterministic provisional `expiresAt = createdAt + 24h`, publication/moderation state, deletion tracking as needed; avoid client-writeable `createdAt`/expiry and unverifiable "viewed by" metrics.
- **Provisional audience:** current ACTIVE group members only; private groups do not expose stories in public discovery or Home; current viewer account eligibility, block/redaction, author visibility and group archive/member-removal re-checked at **every list and raw-byte read**. Do not expose photo bytes to a nonmember just because they possess a Story ID or cached URL.
- Expired stories must become inaccessible immediately at read time (`expiresAt <= NOW`), even if physical files have not yet been purged. Avoid stale response caches or bypasses; return `404`. A cleanup mechanism can subsequently purge metadata/files following approved retention; do not promise physical deletion exactly at the 24h mark if no reliable worker is running.
- Provisional create audience: eligible active group members; owner/moderator may hide/remove abusive stories. Draft/staged writes are acceptable before owner sign-off, but **creation/publication and story consumption must not be advertised LIVE** until D-06 approval. Personal `Your Story` authoring remains deferred unless clearly approved.
- Suggested future route patterns (adapt to repo): `GET /v1/groups/:groupId/stories`, `POST /v1/groups/:groupId/stories` (multipart validated media), `GET /v1/groups/:groupId/stories/:storyId/media`, `DELETE /v1/groups/:groupId/stories/:storyId`; limited `GET /v1/me/community-stories` or `GET /v1/home` Story section only **after** fully authorized LIVE activation. Never convert the current Home `{status: 'DEFERRED'}` into fabricated Story records.

## 4. Group Poll foundation (owner-gated activation)

- Use the existing group as source of membership and authorization; add normalized bounded `CommunityPoll`, options and votes with clear FKs/unique constraints and transaction/collision protection. Recommended provisional MVP: **single-choice**, 2–6 distinct non-empty options, one vote/user/poll, no vote edits, creator sets a bounded closesAt, no anonymous voters. Results derive from DB votes, not client counts.
- Only current ACTIVE group members may view/vote. Block and moderation policies still apply; archival, deleted posts and closed/expired polls cannot accept votes. Votes should not disclose voter identities to ordinary members. Stable immutable option IDs; no duplicate votes on concurrent retries. Do not create a fake Poll in the feed without authorized source data.
- Integrate polls with existing `CommunityPost` only where safe; never fork likes/comments into parallel content. Polls should honor current post deletion/moderation and group membership.
- Suggested future route patterns: `POST /v1/groups/:groupId/posts/:postId/poll`, `GET /v1/groups/:groupId/posts/:postId/poll`, `PUT /v1/groups/:groupId/posts/:postId/poll/vote`, with client-visible capabilities marked unavailable until D-06 approval.

## 5. Abuse, moderation & reporting foundations

- Support member reporting of group media/content to current group owner/moderators with minimal bounded reason enum and abuse/rate limits; avoid accepting arbitrary sensitive evidence or spammy duplicate reports. Require server-controlled review states (e.g. OPEN, RESOLVED, DISMISSED) if implemented; do not claim a human has reviewed when none has.
- Current group moderators may hide/remove harmful content within their actual permissions; authors may remove their own permitted posts/stories/media. A report must not auto-KYC-verify, auto-suspend user accounts, or remove an activity RSVP. Admin audit should avoid leaking reports to unrelated members.
- Ensure group-owner reports are handled conservatively: don't promise independent platform escalation while operator tooling does not exist. If reports/moderation are beyond safe MVP, keep publication gated; document the missing required human moderation capacity.

## 6. One consolidated provisional owner-decision table (D-06; NOT auto-approved)

Record at most one concise owner decision table, with these defaults **for explicit future approval**:

| Decision | Proposed conservative behavior | Status now |
|---|---|---|
| D06-01 Story publisher / audience | Current ACTIVE members create; current ACTIVE members view, no public discovery | PROVISIONAL |
| D06-02 Expiry & cleanup | 24h from server creation for visibility; read-time deny at expiration; physical file cleanup async/manual with retention policy pending | PROVISIONAL |
| D06-03 Media & moderation | JPEG/PNG/WebP, <=5 MiB, server re-encode, self/owner/mod removal; production moderation/operator workflows required before release | PROVISIONAL |
| D06-04 Personal vs group stories | Group Stories only now; separate `Your Story` personal-public semantics deferred | PROVISIONAL |
| D06-05 Photo posts | Max one safely processed photo attached to existing group post; member-only viewing; no public media | PROVISIONAL |
| D06-06 Polls | Single-choice, 2–6 options, one immutable vote/member, server derived counts, member-only | PROVISIONAL |
| D06-07 Report handling | Minimal bounded report intake/moderator review; no fake platform trust badge or guaranteed turnaround | PROVISIONAL |

Do not treat Figma example labels as approvals for universal government-ID verification, E2EE, public image hosting, group-membership side effects or production deletion guarantees. Previously open social, D-18 notification/media retention, MKT/JOB, SET, consent canonical versions and D-08 membership/billing remain OPEN.

## 7. Testing, migration & Neon verification

- Additive, forward-only migration(s) only. Existing Tasks 006–015 tables and migration history unchanged. Inspect all DB constraints (unique vote, ownership, media keys, indexes by group/expiration/state) and ensure transaction/cascade behavior is safe.
- Use current **Neon** `strangeup_dev` and isolated `strangeup_test` configs; inspect identity guard (database name, role, environment) before migrations or integration cleanup. Never truncate or mutate development/production data through test helpers. No printout of connection strings/secrets.
- Run `prisma validate`/`generate`, `typecheck`, `lint`, `format:check`, unit tests and build. For existing CRLF warnings, report independently without broad unrequested rewriting; format only changed files.
- Integration tests in `strangeup_test`: group membership added/removed, private-group member/nonmember, author blocked, suspended/ineligible viewer, one member attempts another group's image URL, malformed file/SVG/mime spoof/oversized/decompression, photo post ownership/moderation, Story read before/after expiry and cleanup retry, stale cached IDs, Stories inaccessible while activation off, concurrent poll vote uniqueness and vote result privacy, deleted/archived content, status of Home `stories` until approval, Task 013 feeds unchanged by staged media, Task 010 meeting private data unchanged, and Tasks 006–015 regressions. If feature flag enabled in test, prove routes remain fail-closed in normal/default configuration.
- Re-run the full Neon integration suite once at section completion; report actual counts, 1 prior intentional skip by precise test name, no pass inference from fixtures. Do not weaken checks to get green.

## 8. Documentation & final deliverable

Synchronize `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` (next section), applicable `openapi/groups.yaml`, `openapi/home.yaml` and new media/story/poll spec as appropriate; `STATUS.md`, `ACTIVE_SCOPE_AND_DEFERRALS.md`, `OPEN_QUESTIONS.md`, D-06 group decision file, and an updated Figma Groups/Home Stories parity matrix.

Documentation must explicitly distinguish:
- Existing Tasks 006–015 routes **LIVE & integration-tested**, subject to actual regression evidence.
- Task 016 **internal/DEV_ONLY/disabled** media/Story/Poll routes, if owner sign-off still missing.
- Truly owner-approved and tested LIVE media routes **only if explicit owner decision exists and tests pass**.
- Personal Stories, media push, presence, global/public Story discovery, notification fanout, production storage/moderation and reliable expiration worker **DEFERRED** until genuinely implemented and approved.

Return one comprehensive engineering report: exact API paths and activation state; code/modules/migration list; policy ACL matrix; integration/unit test evidence; read-time expiry, idempotency, media sanitization and cleanup findings; updated Home capabilities; existing intentional skipped test; media/storage risks; one consolidated D-06 owner table; remaining production blockers; Git changes (no commits/push). Recommend the next large feature section (Membership Plans/entitlements without fake billing, or approved subscriptions/payments when D-08/MKT-03 is resolved).
