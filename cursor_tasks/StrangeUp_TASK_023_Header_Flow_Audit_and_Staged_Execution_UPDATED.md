# StrangeUp — Task 023 (UPDATED)
## Header Flow — Source-Audited Backend Plan & Controlled Implementation Phases

**Status:** Pre-implementation source audit COMPLETED by Cursor. **Phase 023A NOT yet executed.**

**Supersedes:** The earlier `StrangeUp_TASK_023_Header_Flow_Audit_and_Staged_Execution.md` (pre-audit assumptions and original four-phase structure). Use this revised version as the **working Task 023 specification**.

**Owner inputs:** `Strange up(header flow).zip` + Header Flow image; read-only Cursor report *Task 023 — Pre-Implementation Audit (Header Flow)*, supplied October 28, 2026.

**Scope & evidence boundary:** The statuses below are from Cursor's inspection of the actual local repository, Prisma schema, dependencies, source modules and docs, **reported by Cursor** rather than independently executed by this document's author. Reconfirm the specific implementation and tests in each phase before changing code. The PDF export provides appearance and controls, but not authoritative clickable prototype connections. This document should NOT be mistaken for evidence of implemented Socket.IO/FCM.

---

## 1. How this Header Flow works

Header is a **branching navigation surface**, not a sequential wizard:
- **Messages/Chat List** (Figma Screen 16) → direct chat (Screen 17), group chat, requests tab, New Chat.
- **Groups** (Screen 14) → search/filter, My Groups, group cards and create/join/group details.
- **Notifications** (`Html → Notification.pdf`) → unread/read-all, cards linking to real underlying event targets and actions if such domain features exist.
- **Profile/avatar and bottom navigation** appear in screenshots, but their own full flows require separate evidence.
- Header ZIP includes `Mask group.pdf`, a label rather than an interactive app screen.

Additional **Screen 08 Home** and **Screen 15 group context** were cited by Cursor's code audit; they are **not proof of clickable transitions** in the four main Header Flow design screens. Do not fabricate navigation paths, mock notifications or identity/billing claims from static designs.

### Unchanged overarching access policy

Task **022A–D** overrides older group/social policy comments: **no user enters the main app (including messages, groups and notifications) before successful trusted current ID verification + StrangeUp admin approval + account/email/age/consent eligibility**. All newly exposed REST endpoints, socket connections and device registration must enforce this gate. Existing blocks, consent-to-DM, group membership/privacy and audit rules remain in place. A stale JWT must never confer access after revocation.

---

## 2. Verified-via-source-audit implementation inventory

| Capability | Current reported implementation | Source evidence or caveat |
|---|---|---|
| 1:1 DM + request acceptance | IMPLEMENTED (REST) | `src/modules/social/social.routes.ts`, `conversation.service.ts`, `message-request.service.ts` |
| Conversation search `q`, read/unread | IMPLEMENTED | `GET /v1/me/conversations`, `DirectConversationParticipant.lastReadMessageId` |
| Group chat + group-chat list | IMPLEMENTED (REST) | `/v1/groups/:groupId/chat/messages`, `/chat/read`, `GET /v1/me/group-chats`, `group-chat.service.ts` |
| Idempotent sends | IMPLEMENTED | DB uniqueness on `clientMessageId` for direct/group messages |
| Groups discover/search/create/join | IMPLEMENTED | `GET /v1/groups` (`q/category/city/region/privacy/tag/cursor`), category catalog, join/approval flows |
| In-app notifications + bell count | IMPLEMENTED | `notification.service.ts`, `NotificationEmitter`, `GET /v1/home.notificationsUnreadCount`, read/read-all APIs |
| Notification event coverage | PARTIAL | No group-chat notification; no authentic billing or personal meetup invitation events |
| Header unified message badge | MISSING | No aggregate endpoint; Flutter currently combines separate lists/counts |
| Global search | MISSING / NEEDS PRODUCT DECISION | Domain-specific searches exist, not a federated API |
| Socket.IO / WebSockets | MISSING | No `socket.io` dependency; `src/server.ts` uses Express HTTP; currently pull/poll only |
| Typing and presence | MISSING / DEFERRED | No real-time transport; online status must not be fabricated |
| DM or group-chat photo attachments | MISSING | Text body model; object storage does not automatically create secure chat-media semantics |
| Peer-visible delivery receipts | MISSING | Stored read watermark alone is **not** a confirmed recipient delivery receipt |
| Firebase Admin / FCM | MISSING | No `firebase-admin`, config, device token model or push sender |
| Device tokens / notification preferences | MISSING | No Prisma schema, registration/revoke or preference endpoints |
| Group invitations by owner | MISSING | Existing self-join/private-group approval ≠ invitation workflow |
| Task 022 HTTP app gate | IMPLEMENTED | `src/app.ts` gated mounts, `require-home-access.ts`, `/v1/me` pre-gate versus gated split |
| Blocking/privacy | IMPLEMENTED with gaps to revalidate | `social-access.ts`, `conversation.service.ts`, group access, recipient-scoped notifications |

**Important audit detail:** Existing `ioredis` currently supports **rate limiting**, not socket room distribution or real-time pub/sub; Resend is **authentication email**, not push notification delivery. The S3 adapter stores avatars and selected group content, **not DM attachments**.

### Preserve, do not reimplement

1. Persistent Prisma/Neon messages, conversations, direct/group read watermarks, `clientMessageId` idempotency.
2. Explicit message-request acceptance before 1:1 messaging. A mutual follow is **not** automatic DM consent.
3. Authenticated recipient/member-scoped reads, blocking rules (including intentionally generic 404), group membership and hidden private media.
4. In-app notification deduplication/aggregation and existing notification records.
5. Task 022 current DB-backed authorization and provider+admin alignment; admin-only review endpoints stay staff-only.

---

## 3. Implementation strategy: ONE phase per Cursor run

No broad rewrite and no multiple phases in one request. **After each phase, STOP, deliver source-evidenced report, and wait for owner review before next phase.**

### Phase 023A — Header composition & messaging summary (REST only) — START HERE

**Goal:** Enable Flutter to compose accurate header/message badges from existing sources without introducing Socket.IO/FCM prematurely.

1. Inspect current `GET /v1/home`, direct conversation list, `/v1/me/group-chats`, message request inbox, notifications and mounted middleware. Review query performance and privacy.
2. Introduce a small **Home-gated, authenticated** read-only messaging summary contract (suggested `GET /v1/me/messaging/summary`, only if actual route patterns support it). It should derive at minimum `directUnread`, `groupUnread`, `messageRequestsPending` and a clearly defined `totalUnread` or `displayBadgeCount`; **do not invent counts or conflate unread messages with requests**. If the existing Home API is a better minimal-diff solution, explain why before changing its contract. Define badge aggregation explicitly (avoid double counting).
3. Count only conversations/groups the current user is allowed to see; blocked/left/removed participants and private groups must not leak through counts. Reuse existing read watermark logic and existing services/queries where safe. Document badge behavior for missing/muted/archived cases rather than guessing unsupported models.
4. Maintain task 022 full-activation restrictions, cursor/list pagination semantics and backward compatibility.
5. Produce a **screen/control → existing route → response → gate → missing state** mapping for Screen 16 and the Header UI, with clear Flutter-only items.
6. Run `prisma validate` (if schema touched), typecheck, lint, build, unit tests and **targeted bounded** Neon integration for summary/counts (including two users, blocks, group leave, unapproved user). Do NOT run the full Neon suite.
7. Update `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md`, relevant OpenAPI and `STATUS.md`. **STOP after 023A.**

**Not in 023A:** Socket.IO, FCM, typing, presence, media, personal meetup invites, new group invitations, new billing/verification events.

**Accept when:** Counts match authoritative persisted data, are role/privacy-safe, remain correct after read-state change, and unauthorized users cannot call the summary route.

### Phase 023B — Secure Socket.IO real-time messaging

**Gate:** Owner reviews and approves 023A. This phase should NOT start automatically.

1. Install/wire Socket.IO to the existing Node HTTP server **without replacing or duplicating REST persistence**, preserving clean startup/shutdown and testability.
2. Authenticate handshake with the **existing legitimate access/session mechanism**; re-check DB-backed Task 022 active eligibility on connect and when joining rooms and emitting protected actions. Handle expired/revoked sessions. Never trust userId, conversationId or groupId supplied by client without authorization.
3. Permit DM room subscription only for current authorized accepted-conversation participants and group rooms only for active eligible members; revalidate access when blocks, membership, KYC or admin status changes. Prevent cross-user/cross-group leakage.
4. REST/DB remains source of truth for message creation, sequencing, idempotent `clientMessageId`, read watermarks and retrieval. Real-time events are notifications of committed state; safely reconcile reconnect/gaps through REST. **Do not introduce a second write path bypassing domain validation.**
5. Design for single-instance DEV and document multi-instance scaling requirements (Socket.IO adapter, authenticated Redis pub/sub, sticky session transport considerations); **do not repurpose rate-limit Redis blindly**.
6. Ephemeral typing events MAY be scoped to this phase only if owner has approved them and recipient/room ACL, throttling and expiry are specified. **Do not invent online/presence indicators.** No E2EE claim.
7. Focused unit/socket integration tests for unauthenticated handshake, pending applicant, unauthorized room, blocks, group removal, stale session, reconnect and duplicate event handling. No full Neon regression.
8. Update Flutter socket event contracts and ops docs. **STOP after 023B.**

**Acceptance:** Real-time emits only to currently authorized recipients; no leaked room or admin data; REST remains fully functional if Socket.IO is unavailable.

### Phase 023C — Push-ready device registration and user preferences (FCM still OFF)

**Gate:** Owner reviews/approves 023B.

1. Design least-privilege `DeviceToken` data model with platform (`android|ios`), device binding, token rotation, user/session logout invalidation, ownership, uniqueness and encrypted/secret treatment; include secure forward-only Prisma migration.
2. Establish minimal notification delivery preferences under explicit owner-approved defaults. Do not assume every category or channel is opt-in; consult applicable platform/policy requirements and mark unresolved decisions.
3. Add authenticated, full-activation-gated endpoints to register/update/remove user's **own** tokens and manage/read preferences, without exposing tokens in DTOs/logs.
4. Define event-to-device targeting and privacy contract, including user blocks, KYC/account revocation, stale-device handling, and minimal payload.
5. Add tests for wrong-user token ownership, login/logout, refresh/rotation, duplicated token, revoked device and gated applicant. No actual Firebase requests and no real push.
6. Update OpenAPI, Flutter handoff and config docs. **STOP after 023C.**

**Acceptance:** Device tokens cannot be queried or controlled by another user; push remains explicitly disabled.

### Phase 023D — Feature-gated Firebase Cloud Messaging delivery

**Gate:** Owner reviews/approves 023C AND explicitly authorizes any real test sends. SDK/adapter coding may use mocks; **no production delivery or paid/live external calls without approval**.

1. Add `firebase-admin` sender abstraction with safe disabled/mock mode; validate credentials and production fail-closed configuration. **Never expose service-account JSON/private keys.**
2. Use a reliable outbox/worker process or equivalent durable, idempotent delivery approach; notification DB record/event is authoritative. Ensure retries/backoff, deduplication, terminal failures, invalid token handling, status/audit, and multi-instance safety.
3. Push only after verified recipient targeting and preferences; avoid sensitive message, location, identity, group or personal data in push preview/deep-link fields. Use opaque IDs and Flutter resolves targets through authenticated APIs with current authorization.
4. Cover existing real hooks first (e.g., accepted messaging notifications); never synthesize meetup invitation, billing success or completed identity events without corresponding domain action. Group chat notification emission is separate opt-in product decision to avoid spam.
5. Test adapter and worker with mocks, focused outbox/recipient/duplicate/revoked-device integration. Do not send real FCM pushes or run full Neon suite by default.
6. Document Android/iOS Flutter Firebase configuration responsibilities (backend only). **STOP after 023D.**

**Acceptance:** Controlled delivery is reliable in tests, no sensitive notification leakage, and `PUSH_ENABLED=false` is actually no-op/fail-closed as specified.

### Phase 023E — Groups + notifications parity, final Header Flow acceptance

**Gate:** Owner reviews/approves 023D and supplies any additional group/invitation flow diagrams that should be treated as authoritative.

1. Re-audit Screen 14 group UI: search/filter, My Groups, Create, join, pending/approved membership, group cards and next activity. Reuse Tasks 012/016. Correct genuine missing contracts only.
2. Re-audit notification Figma cards: distinguish database-backed event types from design mockups; validate badge/read-all, notification targets, navigation metadata and authorized inline actions. `Meetup Invitation Accept/Decline` remains **DEFERRED** until its own full owner-confirmed journey is audited.
3. Group invitation by owner is NOT equivalent to member join request. Implement only after explicit product decision defining invite/expire/decline/roles/spam/visibility; otherwise mark deferred.
4. Keep existing no-precise-location rule: **do not implement miles, GPS, nearby sorting** or fake Verified group status without updated authorization/policy. Avoid unsupported paid membership notification, instant ID approval and E2EE promotional claims.
5. Verify header/message/group/notification/privacy action matrix with focused E2E, including Task 022 gate, revoked sessions, blocks, group leave/removal, unread consistency and limited notification delivery. Document actual Figma connector unknowns.
6. Deliver final `FIGMA_HEADER_FLOW_PARITY_TASK023.md`, Flutter handoff and release blockers. Do not claim production Socket.IO or FCM ready absent live authorized verification. **STOP.**

---

## 4. Explicit decisions / deferrals — do not guess

| Topic | Current rule / requirement |
|---|---|
| Every user's first entry to app | **Task 022** full KYC and StrangeUp admin approval before all Header features |
| DMs | Explicit accepted message request, no automatic follow→DM |
| Typing | Can be designed as ephemeral Socket.IO event, but confirm inclusion/policy before implementing |
| Online/active circles | Deferred; no fabricated presence UI |
| Photos in chat | Deferred until own secure attachment/moderation specification |
| Meetup invitation card and Plan Meetup | Separate personal meetup invitation flow; **do not map to Activity RSVP or message requests** |
| Owner group invitations | Separate from join request; requires explicit workflow |
| Location badges/distances | City/region only; no precise coordinates or mile distances |
| Verified Group badge | No approved source of group-certification truth |
| Membership Active | Club billing not configured; do not emit fake paid subscription event |
| Identity Verification Completed | Distinguish provider KYC approval from **final admin activation** |
| E2EE | Do not claim encryption is end-to-end without a real cryptographic design and implementation |
| Notification retention | Owner policy still open; do not invent automatic deletion schedule |
| OAuth / transactional email / live KYC | Remain separately gated; Task 023 does not authorize activation |

---

## 5. Test policy, change safety and reports

**For each phase:**
- Run typecheck, lint, build and relevant unit tests; targeted Neon integration tests **with bounded timeouts** and isolated `strangeup_test`, not production DB.
- Do not run the **full Neon integration/regression suite** each phase; defer until final release-verification gate. Track what was not run. Security-critical changed paths still require focused tests.
- Only forward-only, authorized schema migrations. No destructive resets, production deploy, production external sends, committing/pushing or Flutter implementation.
- Inspect source before editing. Preserve Task 001–022 contracts/data and all previously approved guardrails. No unrelated cleanup or mass formatting.
- Never change a failing security expectation simply to pass a test. Explain actual product behavior and fixture setup.

**Required report:** changed files and migrations, precise API/socket/event contract, before/after access and privacy behavior, tests with counts, deferred tests, known risks and next-phase prerequisites. Stop after the assigned phase.

**Release-only gate:** Complete isolated Neon regression, security review, authorized end-to-end provider tests and production consent/staff operational readiness. No production claims beforehand.

---

## 6. Compact Cursor invocation — Phase 023A ONLY

> Continue StrangeUp BACKEND. Read `cursor_tasks/StrangeUp_TASK_023_Header_Flow_Audit_and_Staged_Execution_UPDATED.md` and the existing Task 023 pre-implementation source audit. Execute **Phase 023A ONLY**: add accurate, gated messaging/header unread summary using existing DM, group-chat and request data; preserve Task 022 activation, blocking/privacy and message consent. Inspect source first, implement minimal changes, run typecheck/lint/build/unit + only bounded focused Neon tests, update OpenAPI/API/Flutter docs. No sockets, Firebase, new invitations, Flutter code, deploys, commits, pushes, destructive DB changes or full integration suite. **STOP after 023A** and deliver engineering report.

**Don't automatically run 023B–023E. Owner reviews each report first.**
