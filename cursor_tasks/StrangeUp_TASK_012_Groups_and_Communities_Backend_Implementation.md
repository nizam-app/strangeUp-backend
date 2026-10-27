# StrangeUp — TASK 012: Groups & Communities Backend

**Type:** Full-section BACKEND implementation milestone, not a planning task.  
**Technology:** Node.js + TypeScript + Express + Prisma + PostgreSQL.  
**Starting point:** Tasks 006–011 IMPLEMENTED IN SOURCE; Task 011 reports **103 unit tests passed**. Database migrations/integration tests for Tasks 006–011 are still **UNVERIFIED** while the configured database credentials remain invalid. Do not claim otherwise.  
**Original Figma evidence to inspect:** `Screen 14_ Groups.pdf`; `Screen 15_ Group Details/Community.pdf`; `Screen 1_ Create Group.pdf`; `Screen 2_ Manage Group Dashboard.pdf`; `Screen 15_ Group Details — Stories, Chat & Meetups Update.pdf`; `Screen 08_ Home Dashboard — Community & Stories Update.pdf`; `Screen 16_ Messages - Chat List.pdf` (group-thread previews). Refer to real PDFs, not just screen numbers/older summaries.

## Primary instruction

**Implement Groups & Communities now as a cohesive backend section.** Build the group entity and lifecycle, searchable discovery, membership and join approvals, owner management, group posts/comments/reactions/pinning, member lists, group chat and existing-Activity association where safely supportable. Deliver working modules/APIs/tests and Flutter handoff. Do not stop at architecture, create duplicate models or get trapped in database credential troubleshooting. For genuinely unapproved policy boundaries, implement conservative self-contained functionality and present **one** consolidated decision table; do not imply the owner signed off.

**Hard limits:** Backend only. Do not request a Flutter repository or write Flutter code. No production operations, destructive DB changes, migration history rewrites, commits/pushes, vendor purchases or KYC bypasses. No invented E2EE, map distance, online presence, verified-community badge, meetups, member counts, thumbnails or marketing claims.

## 0. Reuse and workflow

1. Read `AGENTS.md`, `.cursor/rules/*`, `docs/plans/STATUS.md`, `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md`, `docs/product/OPEN_QUESTIONS.md`, approved D-02/D-03/D-04 and KYC enforcement decisions, plus `D-SOCIAL-TASK011.md` (its social-policy choices are *provisional* until owner approval).
2. Inspect current Prisma schema, migrations, routes, authorization/account-policy, Task 009 blocks/discovery, Task 010 activities/RSVP/KYC, Task 011 social/chat, Task 008A Sharp-based media handling, API/OpenAPI conventions, and exact Figma PDFs. Avoid reimplementing available primitives.
3. Implement additive, forward-only migrations; stable access-control checks, services, DTOs, controllers/routes and bounded indexes; focused unit tests plus meaningful integration tests. Preserve previous migrations and modules.
4. During coding run `prisma validate`/`generate`, typecheck, lint, formatting, unit tests and build. Integration suite should be written and executed **only after** a healthy, isolated real PostgreSQL test DB is configured and passes identity guard. If `.env` still has `YOUR_PASSWORD`, report clearly `WRITTEN — NOT RUN`, never fake success.
5. Update source-aligned API documentation and deliver one complete evidence-based engineering report (files, migrations, endpoints, authorization matrix, tests and risks, current database blocker and recommended next full Figma section).

## 1. Figma evidence and safe scope

| Figma | Implement now | Do **not** claim without real implementation/approval |
|---|---|---|
| Screen 14 — Groups | Discover/search/filter groups; `My Groups`; create/join; member counts based on actual DB rows; category/tags; public-safe group cards | Miles away, location verification, universal member KYC, fabricated meetups or `Active Daily` presence |
| Screen 1 — Create Group | Name (visible 60-character counter), about, primary category, tags, city/region, PUBLIC vs PRIVATE_APPROVAL, weekly/active-daily/biweekly *descriptive frequency*, optional member capacity; safe cover upload | Geocoding, precise device location, auto-created meetups, free-form tags without limits/moderation |
| Screen 2 — Manage Group | Owner/admin summary, edit, pending join requests and approve/decline, posts, accurate membership counts | “Live Synced”, trusted verification or sample growth stats when not backed by data |
| Screen 15 — Group Details | Public-safe header/About, Members, Posts, join status, pinned announcement, create-post, comments, likes | Fake verification badge, sample 428-member list, unapproved person data, share event having happened |
| Screen 15 — Stories/Chat/Meetups update | Group chat; accurate group-owned activity associations; group stories **only if** safe 24h media and access semantics can be implemented and verified within this milestone | Cross-feature placeholders; pretending personal Stories, live group chat/push, or auto-generated events exist |
| Screen 08 — Community & Stories update | Reusable `My Groups`, joined-group feed and group activity data for a future Home Dashboard | “142 active peers”, distance, real-time presence, 24h stories without real expiry, universal biometric check |
| Screen 16 — Chat List | Group-chat thread data contract, unread/read state for future unified client list; existing 1:1 direct messaging untouched | Device delivery, typing, E2EE, 5 users online, fabricated group notifications |

### Recommended provisional MVP behavior (do not represent as owner approval)

- Only active, eligible 18+ email-verified accounts can create, join and contribute. **Government-ID KYC is NOT required merely to browse or join a community group.** Task 010's provider-validated KYC gates remain mandatory for real-world activity publishing/RSVP/meeting-location access; joining a group must never confer activity participation.
- PUBLIC groups: discoverable; eligible people can join immediately, subject to capacity and blocks. PRIVATE_APPROVAL groups: *discoverable summary only*, group posts/member lists/chat restricted; joining creates a pending request needing owner/moderator approval. Private does not mean unlisted in the currently visible Figma; do not add unlisted groups without decision.
- Group creator is the initial OWNER and an active member; owners may manage group details, approve membership, pin/remove content and moderate members; provide clear `OWNER`, `MODERATOR`, `MEMBER` permissions if moderators are actually implemented. Owner transfer and no-orphan-owner behavior are essential before allowing owner leave/deletion. Avoid a broad organization-level RBAC redesign.
- Optional capacity counts active members, **not** pending requests; capacity check and approvals are concurrency-safe. Leaving cancels own membership or join request idempotently. Rejoining after a decline/removal must be bounded to avoid harassment; if rule not approved, default to deny/reapply only through explicit moderated flow, and record choice.
- Group discussions/chat are not public discovery data. Restrict posts, comments, member lists and group messages to active group members and staff who are eligible by policy. Do not imply an invited/approved status without a stored decision.
- Group members can post text/comment/react; owner/moderator can pin/unpin and remove posts. If implementing photo posts, reuse safe Sharp validation and dev-only storage with ownership, bounded size and cleanup; do not ship unsafe raw image uploads or promise production media storage/moderation.
- Group chat is distinct from 1:1 DM consent and schema. A participant must have **current active group membership** for chat listing, message reads/writes and unread counts. Use server timestamps and bounded text. Track read watermarks without claiming delivery or E2EE. Removal/leave revokes access immediately (do not implicitly delete historical rows until retention policy exists). A group chat should not create a DirectConversation or bypass direct-message consent.
- An existing Task 009 user block in either direction should prevent direct interaction and avoid leaking blocked-user profile data via group member previews, posts or messages. Apply a defensible restricted-view policy and write tests; document any group moderation edge cases. A block must never magically grant or remove group membership without an explicit rule.
- `Verified Community` and `Verified wristband` example labels have no trusted backend verification source. Never create a fake verified boolean or expose such a badge based on membership, email verification or host assertions.
- Every public user preview must reuse D-03 visibility and blocking, with strict allowlists. Do not expose DOB, email, phone, KYC evidence, avatar storage keys, precise location or private meeting instructions.

## 2. Data model and migration (adapt to existing schema)

Use well-named additive models and indexes, for example:

- `CommunityGroup`: UUID, ownerId, name (max 60 per Figma), description/about, bounded category (a separate approved managed group-category catalog or well-validated bounded enum), city/region **self-reported text**, privacy `PUBLIC | PRIVATE_APPROVAL`, meetupFrequency display-only metadata, optional memberCapacity, status `ACTIVE | ARCHIVED`, cover storage key (private internally), createdAt/updatedAt. Avoid client-set memberCount/verified/nearby/nextMeetup.
- `CommunityGroupTag` or bounded normalized tags with validated length, max per group, clear abuse limits; tags are **not** necessarily Task 007 interest slugs or Task 010 activity categories.
- `CommunityMembership` keyed by `(groupId, userId)` with role/status `PENDING | ACTIVE | DECLINED | REMOVED` as appropriate, timestamps and approver ID. Index by status and group; enforce one membership/request per user/group with idempotency/controlled transitions.
- `CommunityPost`: groupId, authorId, bounded text, pinnedAt/pinnedBy, soft moderation/removal state, timestamps, optional safe cover/media or existing Task 010 `activityId` only after real authorization. Never store HTML and render as trusted content.
- `CommunityPostComment` and `CommunityPostLike` with author/actor IDs and pair uniqueness for likes, searchable bounded pagination. Explicit moderation/deletion and author permissions.
- `CommunityGroupMessage` with groupId, authorId, bounded text, createdAt+id deterministic pagination, optional `clientMessageId` for idempotent retries; `CommunityGroupReadState` for per-member monotonic last-read pointer if chat is implemented.
- Optional group-related activity relationship: use existing Task 010 Activity IDs, actual hosting/organizer permissions and current activity status. Do not create parallel meetups or leak private Task 010 meeting instructions. A group association must not bypass host/publish KYC requirements; ordinary members joining a linked activity still use Task 010 RSVP/KYC APIs.
- Optional `CommunityStory`: only if implementing real supported story endpoints, scoped creator/owner/member access, media processing, `expiresAt=createdAt+24h`, query-time expiration + cleanup job plan. Otherwise explicitly defer story upload/consumption and remove it from LIVE API documentation. The original screen does **not** specify enough to invent personal-story audience or full video/story interactions.

**Constraints and concurrency:** Forward-only migration with unique keys/FKs/indexes for searches, group member statuses, posts and chat pagination. Use DB transactions and appropriate row locks/advisory strategy for competing final-capacity joins and concurrent approvals; prevent overbooking and owner removal. DB unique constraint failures must not turn into unexplained 500s or synthetic 409s unrelated to documented conflicts. No blind cascade across unrelated Activity, User, DirectConversation or legal-retention data.

## 3. Proposed HTTP contract (adapt to repository conventions)

Keep standard existing `{data,meta:{requestId,...}}` response envelope, error schema, JWT/session/account guards, Zod allowlists and indexed opaque cursor pagination. Set realistic default/max page sizes. All routes below are **proposed** until implemented and verified.

### Discovery and group lifecycle

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/groups` | Browse group previews: `q`, category, city/region, privacy, bounded cursor; no fake nearby ordering |
| GET | `/v1/groups/:groupId` | Public-safe group header/About, viewer membership status, accurate counts; private group content omitted |
| GET | `/v1/me/groups` | My memberships, owned/managed groups and pending requests as appropriate |
| POST | `/v1/me/groups` | Create group and OWNER membership atomically |
| GET | `/v1/me/groups/:groupId/manage` | Owner/moderator-only management summary |
| PATCH | `/v1/me/groups/:groupId` | Owner/moderator allowlisted edits (privacy/capacity transitions safely handled) |
| POST | `/v1/groups/:groupId/join` | PUBLIC: join; PRIVATE_APPROVAL: pending request; capacity enforced |
| DELETE | `/v1/groups/:groupId/join` | Leave/cancel own request, respecting owner invariant |
| GET | `/v1/groups/:groupId/members` | Active members, only authorized; D-03-safe user previews |
| GET | `/v1/me/groups/:groupId/join-requests` | Owner/moderator pending membership approvals |
| POST | `/v1/me/groups/:groupId/join-requests/:memberId/approve` | Atomic permission/capacity check, idempotent transition |
| POST | `/v1/me/groups/:groupId/join-requests/:memberId/decline` | Reject pending request, bounded retry policy |
| POST | `/v1/me/groups/:groupId/members/:userId/remove` | Owner/moderator moderation, never remove final owner |
| POST | `/v1/me/groups/:groupId/transfer-ownership` | Explicit owner-only safe transfer; if policy not approved, deny unsafe owner leave and document gap |
| POST | `/v1/me/groups/:groupId/archive` | Owner-only non-destructive archive (if needed to close group); no silent data deletion |

### Group cover media

`POST /v1/me/groups/:groupId/cover` (multipart `cover`), `GET /v1/groups/:groupId/cover`, `DELETE /v1/me/groups/:groupId/cover`. Reuse Task 008A Sharp validation/re-encoding, EXIF stripping, opaque file naming, staged writes/failure cleanup, access checks, and dev-only local disk. Figma shows JPEG/PNG up to 10MB; if using a safer smaller ceiling initially, document exact deviation and Flutter guidance. Do not promise atomic filesystem+DB operations; test and document orphan cleanup risks. No production public bucket/CDN without policy.

### Group posts and discussions

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/groups/:groupId/posts` | Member-gated posts with pinned-first + deterministic pagination |
| POST | `/v1/groups/:groupId/posts` | Authored text post; optional well-authorized Activity link |
| PATCH | `/v1/groups/:groupId/posts/:postId` | Author edits allowed fields; moderation rules |
| DELETE | `/v1/groups/:groupId/posts/:postId` | Author/moderator non-destructive content removal |
| POST | `/v1/groups/:groupId/posts/:postId/pin` | Owner/moderator pin/unpin, idempotent semantics |
| GET | `/v1/groups/:groupId/posts/:postId/comments` | Bounded member-only comments |
| POST | `/v1/groups/:groupId/posts/:postId/comments` | Member-only bounded comment |
| DELETE | `/v1/groups/:groupId/posts/:postId/comments/:commentId` | Author or moderator |
| PUT | `/v1/groups/:groupId/posts/:postId/like` | Idempotent like |
| DELETE | `/v1/groups/:groupId/posts/:postId/like` | Idempotent unlike |

If Figma's `Photo`, `Activity` and `Poll` composer actions cannot safely be completed in this milestone, explicitly mark each as DEFERRED and do not return fake success. Prefer one working text-post vertical slice over broken pretend endpoints; include optional real linked Activity and properly bounded poll only if implemented end-to-end with authorization and tests.

### Group chat (separate from direct DM)

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/me/group-chats` | Only current member groups with conversation previews/unread counts (for Screen 16 future merged list) |
| GET | `/v1/groups/:groupId/chat/messages` | Member-gated paginated text messages |
| POST | `/v1/groups/:groupId/chat/messages` | Member-only text send; idempotent retried clientMessageId |
| POST | `/v1/groups/:groupId/chat/read` | Update own monotonic read watermark |

Don't add online members/typing/WebSocket delivery/E2EE/device delivery unless independently implemented and tested. Honor account suspension, group membership changes and Task 009 blocks on every sensitive access.

### Group-associated meetups and dashboard reuse

`GET /v1/groups/:groupId/activities` should list **real associated** currently visible Activity records only, using Task 010 privacy/public DTO rules. If association APIs are implemented, restrict attach/detach to authorized group organizers and Activity hosts with correct KYC policy; otherwise defer associations rather than showing synthetic `meetups/week` numbers. Reuse group feeds/listings for future Screen 08 Home Dashboard, but do not build a whole unrelated dashboard API in this milestone unless trivial composition reuses existing services securely.

## 4. Access-control / privacy matrix to enforce everywhere

- Anonymous → 401. Ineligible/underage/unverified/suspended accounts → existing appropriate 401/403; group actions require `hasFullAccountAccess` or equivalent verified account policy.
- Nonmembers may see only discoverable GROUP SUMMARY (including PRIVATE_APPROVAL discoverable summary); not private posts, private chat, private roster, cover bytes if private, attendance, owner-management metadata or pending applicants.
- Active members can see group content subject to block/personal-visibility policy. Owner/moderator manage role-specific resources; other members cannot approve requests or remove each other.
- Block in either direction: no direct contact via group endpoints, prevent leaking hidden members' profile data and blocked user-authored content; explicitly test group owner/member edge cases and report deliberate limits.
- Cross-user public previews reuse Task 009 D-03, including KYC-based `VERIFIED_USERS_ONLY` behavior; never expose trusted identity metadata or infer group-member KYC.
- A **group membership is not RSVP, KYC approval, meeting location access, activity acceptance, DM consent, or follow**. All Task 010 and 011 guards remain effective when reached through a group card or linked Activity.
- Private text posts/chat: no sensitive fields logged; sanitized plain-text responses; owner/moderator audit decisions do not reveal applicant DOB/email/phone/KYC details. No universal member IDs in public discovery responses.
- Pagination, uniqueness, rate limiting and moderation/abuse controls: fail closed, avoid unlimited list/includes, no hidden account enumeration; shared production limiter and formal reporting tools remain release blockers if unimplemented.

## 5. Test requirements

**During coding**: run Prisma validation/generate, typecheck, lint, format, `npm test`, build. Include focused unit tests for validators, membership transitions, role matrix, D-03/block interplay, cover validation, post DTO allowlists, cursor logic, anti-spam and group-chat read watermark.

**Write integration tests** (run only after isolated Postgres test DB is available) for at least:

1. Create PUBLIC and PRIVATE_APPROVAL groups, `60`-character name, bounded tags/location/frequency/capacity; owner-only edits and controls.
2. Public join immediate vs private pending; wrong actor cannot approve; decline/duplicate behavior, self leave and owner preservation.
3. Concurrent last-member-capacity join and parallel private approvals => never exceed cap; idempotent requests and no duplicate memberships.
4. Discovery filters, group private summary versus protected posts/member lists, member count from DB only, no unverifiable badge/distance.
5. Group posts create/edit/delete, like/unlike idempotence, comments and pin permissions; hidden/blocked/missing resources return non-enumerating errors.
6. Group cover byte validation, path ownership, EXIF removal and safe staged replacement; deleted/inactive group cannot leak cover bytes.
7. Group chat permission after join, denial after leave/removal/suspension/block, idempotent sends, unread/read correctness, isolation from DirectConversation.
8. D-03 preview redaction, bidirectional blocks, avatar access, non-member/private data isolation, and no private KYC fields.
9. Activity association: group member is **not** RSVP; group admin cannot bypass Task 010 host KYC; meeting instructions remain protected.
10. If stories or linked posts/polls are implemented, full lifecycle, expiry, visibility, idempotency and moderation tests; otherwise accurately mark deferred.
11. Full regression for Tasks 006–011 when test DB available, including Task 010 last-seat KYC and Task 011 DM consent; no quality-gate assertion without run evidence.

## 6. Implementation and handoff evidence

- Update `docs/api/CURRENT_APIS.md` with implemented routes, auth, DTO examples, real status/error codes and verification state; add `openapi/groups.yaml` (or repo-consistent API spec) and sync `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` with join/approval, feed/chat, API paging, media, privacy, KYC disclaimers, no client-side fake sample badges/metrics.
- Update `docs/plans/STATUS.md`, `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md`, `docs/product/OPEN_QUESTIONS.md`, and the original Figma group parity matrix/screen traceability.
- Record all **owner-approved** rules separately from **provisional** group decisions in a concise `D-GROUPS-TASK012.md` decision table: public/private discoverability; creator/moderator roles; member caps/declined reapplication; group join KYC exemption; group-post audience; photo/poll/story retention and moderation; membership after block; group-chat audience/retention; group-linked activity permissions. Do not silently approve social Task 011 provisional choices. No new docs-only task.
- End with a report containing exact source and migration paths, new/changed API inventory, security/access matrix, what's from Figma and what's excluded, tests run (counts), **actual** migration/integration status, known risks, owner decision table, Git status, and recommendation for next major UI section (Community Feed/Stories/Home or Marketplace/Jobs depending on remaining Figma scope).

**Strong preference:** Implement the maximal safe and consistent Groups vertical slice within this one milestone. Make no new milestones merely to defer routine API wiring. If a media/retention/policy dependency prevents one feature, accurately isolate it and continue the rest.
