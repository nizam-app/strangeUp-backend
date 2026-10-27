# StrangeUp — TASK 013: Home Dashboard, Community Feed & Notifications Backend

**Execution:** One substantial Figma-backed BACKEND implementation milestone. **Do not stop at planning.**
**Stack:** Node.js, TypeScript, Express, Prisma 7, PostgreSQL (Neon), existing test harness.
**Baseline as reported by Cursor (2026-10-27):** Task 012 implemented; `npm test` **131 passed / 29 files**; complete Neon integration suite **72 passed, 1 skipped / 9 files**; two isolated databases `strangeup_dev`, `strangeup_test`, PG 18.6. Tasks 006–011 executed in that regression suite. Independently verify this baseline in repository/status; do not call the skip a pass or describe the backend as production-ready.

## Mission

Implement a **real, privacy-safe Home Dashboard composition**, **joined-community feed**, and **in-app notification inbox** using existing Task 009 Discovery, Task 010 Activities/RSVP, Task 011 Social/DM, Task 012 Groups/Posts/Chat and their validated DTOs. Avoid reimplementing these domains or building a generic social-network platform unrelated to the PDFs. Provide working endpoints, additive schema/migration if needed, focused tests, isolated Neon integration and Flutter API handoff.

**Relevant original Figma PDFs, extract and visually inspect from `Strange up(1).zip` (the ZIP is accessible in the project resources):**
- `Screen 08_ Home Dashboard.pdf`
- `Screen 08_ Home Dashboard — Community & Stories Update.pdf`
- `Screen 15_ Group Details — Stories, Chat & Meetups Update.pdf`
- `Html → Notification.pdf`
- `Screen 14_ Groups.pdf`, `Screen 15_ Group Details/Community.pdf`
- `Screen 1_ Create Group.pdf`, `Screen 2_ Manage Group Dashboard.pdf` for D-06 parity follow-up
- `Screen 10_ User Profile.pdf`, `Screen 11_ Activity Discovery.pdf`, and `Screen 16_ Messages/Chat List.pdf` for link/DTO navigation relationships.

**Evidence scope:** The Home update visibly shows a greeting/location header, search/navigation, a 24h Stories row, My Groups, latest joined-group posts (including media illustration), upcoming group meetup, People Near You, Activities Near You, Recommended For You. Notifications visibly shows grouped Today/Earlier cards, unread count, Mark all as read, meetup invitation, activity request accepted, new message, membership/KYC success, group invitation, activity reminder and system update. These are **UI examples**, not proof that all event providers or push/story pipelines exist. Distance, active peers, current online indicators, universal verification and 24h Story publication cannot be fabricated.

## Non-negotiable boundaries

- BACKEND ONLY. Do not request or modify Flutter source, change production, commit, push, reset/drop databases, change applied migration files, or disclose `.env` secrets.
- Preserve tasks 006–012 data, contracts, KYC rules and security. Migration forward-only; no edits to historical migrations.
- All authenticated APIs require existing eligible active, age-eligible, email-verified access unless an established existing policy is stricter. Treat KYC as government-ID provider validated, not email verified.
- D-03 and D-04: profiles visible only when authorized, including `VERIFIED_USERS_ONLY` gating; city/region text only, **no coordinates, distances, geo ranking, maps, online status**.
- Task 009 block policy: enforce current bidirectional blocks at read time, with redacted/null person previews and hidden blocked-authored content. Never leak private profiles through dashboard, feed, notification payloads or links.
- Task 010 real-world activity hosting/join, KYC, RSVP, meeting-details separation and capacity invariants remain the ONLY authorization authority. Dashboard cards must not implicitly RSVP/join.
- Task 011 DM requests/acceptance/block consent remain intact. Notifications cannot create message consent.
- Task 012 private group membership is mandatory for posts/chat/linked private content. Group membership is not an RSVP/KYC/DM grant; `D-GROUPS-TASK012` **D-06 remains provisional** until owner approves it.
- No fabricated follower/member/meetup/RSVP/unread counts, recommendations, activity status, ratings or trusted badges. Use real DB queries; omit fields when not available.
- Neither Story publication nor production media retention/moderation is approved. Do not expose fake LIVE Stories routes merely to fill the visible UI; implement other features independently.

## 1. Home dashboard: server-side composition

Implement one authenticated endpoint, suggested `GET /v1/home` (adapt to existing route conventions; do not conflict with existing names), with a bounded, stable envelope. Favor parallel calls to **existing services/authorized projections**, not copied logic or N+1. Return composable, explicit fields and safe empty arrays:

- `myGroups`: current active member groups, real post counts/new-post counts **only when defensibly computed**, accessible last activity and public-safe cover information; no invented "Active 10m" or location miles. Use Task 012 membership and cover authorization.
- `communityFeedPreview`: latest permitted text posts/pins from active member groups; present member-visible posts only; D-03 safe author previews; no fake image if only text posts are stored.
- `upcomingGroupActivities`: actual Task 012 linked Task 010 published upcoming activities for viewer's active groups, with public-safe activity DTO, RSVP summary when authorized; **never exact meeting instructions**.
- `people`: limited Task 009 discoverable public-profile previews, not "nearest"; obey KYC-based visibility and blocks. Use deterministic sort established by discovery.
- `activities`: bounded Task 010 upcoming-public-activities list, no invented nearest ranking; KYC needed only on actual join/host operations.
- `recommended`: safely reuse an existing deterministic discoverable activity/group query, **never assert a personalized ML recommendation**. If rules not approved, expose `featured` / `recent` backed by real records, or omit recommendation section.
- `notificationsUnreadCount`: from Task 013 inbox, recipient-scoped and status backed by DB.
- `stories`: **not LIVE** until a separately approved story audience, deletion/retention and moderation policy is implemented and verified. Use no dummy story list; report deferred to Flutter.

Allow bounded per-section limits/defaults; avoid returning all content across all groups. Preserve source IDs/type labels and stable action links only to real endpoints. If one optional section has no eligible data, do not invent a card. Do not silently return old private content when a group is archived, membership revoked, block introduced or profile visibility changed.

## 2. Community feed: cross-group personalized read

Implement `GET /v1/me/community-feed` with deterministic cursor pagination, safe max limit, and optional existing supported filters such as `groupId` or `type` only when grounded in actual source models.

- Aggregate Task 012 `CommunityPost` from groups where the viewer has **current ACTIVE membership** and eligibility; exclude archived/removed/private unauthorized groups; exclude blocked authors and redact identity previews blocked by D-03.
- Reuse Task 012 post/card DTOs, canonical IDs and comment/like counts; no shadow post table or duplicate likes/comments data. Sort by backed real timestamps with stable ID tie-breaker; account for pinned posts: group-local pins must not become unbounded global priority unless explicit rule.
- Member leaves/gets removed or is blocked during pagination: must not receive old protected posts. Re-check permissions on every page.
- Group activity links in posts must satisfy Task 010 access rules. Never embed private meeting addresses/instructions or meeting token in feed DTOs.
- **Photo posts, Polls, Shares, Stories** have no approved end-to-end safe pipelines. Do not invent media bodies/reposts/vote counts; keep action surfaces disabled/deferred in Flutter handoff until real APIs exist.

## 3. In-app Notifications: real inbox, not fake events

Implement a minimal but robust persisted per-recipient notification domain, as needed. Suggested additive `UserNotification` (UUID id, recipientId FK, bounded typed event, actor/source IDs as appropriate, safe generic title/body or normalized DTO, `createdAt`, nullable `readAt`, deduplication key), indexes for `(recipientId, createdAt, id)` and unread. Dedupe retries; do not store auth tokens or arbitrary raw private meeting instructions.

Suggested APIs (adjust to repo conventions):

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/me/notifications` | Recipient-only cursor pagination, optional `unreadOnly`, returned `unreadCount` or metadata |
| POST | `/v1/me/notifications/:notificationId/read` | Idempotent recipient-only read |
| POST | `/v1/me/notifications/read-all` | Recipient-only bounded/atomic mark-read semantics |

- Emit notifications **only on backed real application events**, e.g. received message request, accepted message request, incoming accepted direct message, actual group join approval/decline, and real RSVP status changes. Avoid broad rewrites to Tasks 010–012; introduce minimal event hooks/transactional outbox if truly needed for reliable commit semantics. If source action fails/rolls back, do not emit success notification. Retries should not duplicate notifications.
- Notification content at read time must not reveal blocked/missing/suspended/hidden actor profiles or private activity/group details. Choose generic/redacted content or omit if current access fails. Source action IDs alone are not authorization; routes still enforce target ACL.
- Mock Figma event categories `Membership Active`, `Identity Verification Completed`, `Group Invitation`, `Upcoming Activity`, `Meetup Invitation` are **NOT LIVE** merely because they appear in the PDF. Create an event type only if its source module actually produces trustworthy state. No invented Stripe/KYC provider success, invitation acceptance, scheduled reminders or guaranteed push.
- Delivery is **in-app pull** only. No push, email, WebSocket, background scheduler, activity reminder daemon, device delivery or E2EE claims unless actually implemented, tested and authorized.
- Notification retention and user deletion/privacy need one **provisional bounded default** recorded as OPEN for owner and a safe cleanup strategy; don't promise legal retention/delete completeness without policy.
- Add modest anti-spam/aggregation for chat message notifications, with no event dropping that breaks accounting. Keep response small and well-indexed.

## 4. 24-hour Stories: explicit deferral/conditional implementation

Figma shows `COMMUNITY STORIES — 24h Disappearing` and a Stories tab in group details, but does not by itself specify approved author permissions, visibility at group-leave time, report/moderation, media retention, view receipt/privacy, or expiration cleanup. D-06 lists stories/photo posts/polls as deferred; follow that. **Do not add public/live story creation, view, or fake expiry routes in Task 013 without explicit owner policy approval.** If an existing approved owner decision is found in-repo, implement the safely bounded story slice with actual expiry/read-time enforcement, deterministic cleanup, image processing, visibility and tests; otherwise record exactly what remains deferred in parity and Flutter handoff. Build the Home/Feed/Notification features now regardless.

## 5. Quality, migrations and verification

- Inspect `AGENTS.md`, `.cursor/rules/`, Prisma schema and Tasks 009–012 services; avoid schema/DTO/service duplication. Prefer one additive migration for inbox only if required.
- Run Prisma validation and client generate; typecheck, lint, format, all unit tests, build.
- Existing Neon dev/test DBs are reported as healthy: **use the existing `.env` / Neon scripts and identity guards**; never print credentials, don't infer safe test DB from hostname alone. Validate `current_database()` and role before any cleanup. Tests may truncate only the explicitly isolated `strangeup_test` after passing guard; never truncate `strangeup_dev`/production. Apply forward-only migration using project conventions to dev and test, after inspection.
- Add comprehensive integration cases: home composition from seeded real records and correct empty states; authorized feed across groups; revoked membership, private groups, blocks/visibility/KYC gate; cursor stability; linked activity visibility and meeting details nonleak; notification recipient isolation, unread counts, idempotent read/read-all, exact event generation and dedupe, rollback semantics, actor redaction/block; concurrent events/rate limits where relevant; negative token/auth cases; full Tasks 006–012 regression. **Re-run full isolated Neon integration suite once at section closure**, not after every microchange.
- Report exact numbers; identify the prior **1 skipped integration test by test name and reason**, and whether it remains skipped. Don't silently convert skips into pass or weaken tests just to claim green.

## 6. Docs and output requirements

Synchronize `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` (next section), `openapi/home.yaml` / `openapi/notifications.yaml` or repo-consistent specs, `docs/plans/STATUS.md`, `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md`, `docs/product/OPEN_QUESTIONS.md`, and new Home/Feed/Notification Figma parity matrix.

Explicitly label **LIVE and integration verified**, **implemented but verification pending**, **not implemented**, **owner decision pending**. Document pagination, sample safe DTOs, auth, privacy, exact error/status behavior, empty states and Flutter navigation targets. Do not make Flutter changes.

Add at most one concise consolidated owner-decision section for remaining Home/Feed/Notification/story policies (story audience, expiration and deletion, media moderation, notifications retention, aggregate feed ordering). Keep previously shipped D-06 Social/Groups decisions OPEN unless explicitly approved. Do **not** stop the task on those questions when safe implementations are independent.

Return ONE complete engineering report: APIs, files, migration(s), demo-safe example JSON, Figma implemented/deferred mapping, tests actually executed and skipped case, Neon migration/identity evidence without secrets, decision table, remaining launch blockers, Git status; no commits/pushes, no changes to prod. Next after this section: finish policy-dependent Stories/media or move to Marketplace/Jobs per remaining Figma coverage.
