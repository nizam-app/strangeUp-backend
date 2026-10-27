# StrangeUp — TASK 011: Social Connections & One-to-One Messaging Backend

**Type:** One substantial BACKEND implementation milestone, not a docs-only plan.  
**Stack:** Node.js, TypeScript, Express, Prisma, PostgreSQL.  
**Design evidence:** Original Figma `Screen 10_ User Profile.pdf` (Follow, Message, Wave), `Screen 16_ Messages/Chat List.pdf` (recent chats, requests, unread/search), `Screen 17_ Chat Conversation.pdf` (direct-message thread, timestamps, read state), `Screen 09_ Discover/Nearby People.pdf` (Say Hi / Wave), and `Screen 08_ Home Dashboard.pdf` (social entry points).  
**Starting state:** Tasks 006–010 implemented; Task 010 reports 92 passing unit tests. **All native PostgreSQL migrations and integration suites for Tasks 006–010 remain unverified** because `.env` contains the local PostgreSQL password placeholder. Do not claim they passed.  
**Implementation goal:** Deliver a secure, usable social graph + consent-based, text-only 1:1 messaging backend. Implement all independently supportable functions in one pass. Do not add unsupported chat marketing claims or reimplement existing discovery/activity modules.

## 0. Execution workflow (do not stop at planning)

1. Read `AGENTS.md`, `.cursor/rules/*`, `docs/plans/STATUS.md`, `ACTIVE_SCOPE_AND_DEFERRALS.md`, `docs/product/OPEN_QUESTIONS.md`, applicable D-02/D-03/D-04/KYC decisions, current API docs, Flutter handoff, Prisma schema, migrations, existing authorization/discovery/blocks/activity services and tests.
2. **Open the actual Figma PDFs** named above. Check visible controls and do not mistake sample names, counts, verification, activity associations or message text for production data.
3. Implement a cohesive vertical slice: Follow/Unfollow, Wave, DM requests, acceptance/decline, direct conversations, messages, list/unread/read state. Prefer existing route/DTO/envelope conventions and reusable D-03/D-04 authorization rather than duplicate policy logic.
4. For policy choices not yet expressly owner-approved, follow the **conservative MVP provisional rules** below; do not present them as final owner decisions. Add **one concise consolidated decision table** in final report. Do not block independently safe implementation on a new planning-only milestone.
5. Execute fast quality gates and unit tests during coding. Write integration tests (including race and abuse paths). Do not keep retrying Prisma Dev; while native DB auth fails, report integration **WRITTEN — NOT EXECUTED**.
6. Update all contracts/docs and return one detailed implementation report. **Backend only. No Flutter repo access/code, commits, pushes, production operations, migration rewrites, data resets or secret exposure.**

## 1. Figma mapping and honest scope

| Figma surface | Implement now | Not live in this task |
|---|---|---|
| Screen 10 User Profile | Follow/unfollow relationship; Message entry point based on permitted DM request/conversation; Wave | Fake ratings, follower counts not backed by rows, proximity, status/verified badge without proof |
| Screen 09 Nearby People | Authorized Wave/Follow/Message intents using Task 009 public profile visibility and blocks | Distance, nearby/radius, inferred shared meetups, fake presence |
| Screen 16 Messages/Chat List | Direct conversation list, filtered search, unread count, incoming message requests; self-only results | `ACTIVE CIRCLES` online now, group chat with 428 sample members, push/websocket presence, fabricated chat history |
| Screen 17 Chat Conversation | 1:1 text messages; server timestamps; read acknowledgments; cursor pagination | “Verified & End-to-End Encrypted Chat” (not implemented), “ID Checked” as universal badge, device delivered state, typing indicators, photo attachments, Plan Meetup action, event/chat invitation action |

**Security/release copy warning:** Current app does **not** have verified end-to-end encrypted messaging. TLS/at-rest database encryption is not E2EE. Do not invent ciphertext, encryption keys or show the Figma claim as truth; flag it to Flutter/design owner. Similarly, do not invent government-ID verification or online/presence claims.

## 2. Policy and authorization

- **Viewer/account gate:** Existing `hasFullAccountAccess` (active, email-verified, 18+ eligible) for creating/retrieving social relationships and conversations; no government-ID requirement for ordinary social chat. Preserve session checks and account suspensions.
- **New relationship/contact requests:** Resolve target using Task 009 D-03 public-visibility policy and bidirectional block rules. `VERIFIED_USERS_ONLY` requires current trusted provider-based KYC `APPROVED` for a viewer to initiate new contact. Never use email verification as KYC; fail closed on stale/expired/revoked provider state where availability is known. Hidden, blocked, deleted, suspended, ineligible or missing target: generic 404, avoiding user enumeration.
- **Self-target:** invalid 400; never create self-follow, self-wave, self-request, or self-conversation.
- **Block:** An active block in either direction immediately disables new follow/wave/request, conversation content reads, message sends, and participant metadata access (including through guessed IDs). Unblocking does **not** silently create/reaccept new permission; report precise implemented behavior. Keep existing task 009 block endpoints unchanged. Do not leak blocked users' content through search, unread counts, previews, or response differentiation.
- **DM consent by default:** A non-mutual person cannot send arbitrary chat messages into the recipient's conversations without accepted consent. `Message` on a profile should create a **request**, not automatically transmit an unsolicited message. A recipient can accept or decline. Avoid attachments/first-message text in the request unless an approved anti-abuse rule and validation already exist. Mutual follows may **not** silently auto-authorize messaging without explicit product approval. Use explicit request acceptance for the MVP.
- **Existing accepted conversations and later visibility changes:** Preserve valid accepted consent unless explicitly withdrawn or blocked, but apply current account eligibility and block status to *every* read/send. This is a **provisional owner policy** to report, not a newly approved D-03 interpretation. Do not expose profile-only fields simply because a conversation exists.
- **Follow graph:** Following is unilateral; one row per `(followerId, followingId)`; no automatic reciprocation, no KYC shortcut and no implied notification delivery. Users can always unfollow their own rows; self-only follower/following lists use public-safe previews only when current visibility permits. Count accurately from the database, and only expose counts in otherwise authorized public DTOs after tests.
- **Wave:** A small persisted greeting/intent separate from chat messages; never automatically grant DM access or send a fabricated push notification. One outstanding wave per actor/target pair or another documented bounded idempotent design; rate-limit/replay protect. Recipient can see only their own incoming waves. Do not invent arbitrary recurrence/expiry/acceptance rules; list as owner decision if needed.
- **Flood/abuse:** Existing in-memory limiter alone is insufficient for distributed production. Use database uniqueness/idempotency and bounded operations to prevent repeated pending requests, duplicate follow/wave spam and mass-enumeration; document required production shared rate limiting/moderation/report tools.
- **No activity/KYC backdoor:** Social conversations cannot replace trusted KYC/RSVP checks for real-world meetups. Do not leak `Activity.meetingInstructions` into conversation DTOs or infer users are joined based on chat membership.

## 3. Additive schema and safe migrations

Design forward-only Prisma schema/migrations consistent with the existing repository:

- `UserFollow`: follower/target IDs (cascade/retention policy review), unique pair, createdAt; indexes for follower/following lists/counts.
- `UserWave`: sender/recipient, createdAt, optional well-justified limited state. Persist at most one relevant active greeting per pair; avoid unbounded wave creation/refresh if a duplicate arrives.
- `DirectMessageRequest` (or equivalent): sender, recipient, `PENDING | ACCEPTED | DECLINED` plus timestamp(s), canonical pair uniqueness or safe transactional handling for cross-requests; server-only transitions; recipient-only accept/decline; no repeat harassment after decline without an approved cooldown/retry policy.
- `DirectConversation`: stable UUID and **two distinct, canonically ordered participant IDs**, unique unordered pair, `createdAt`, `updatedAt`; no public ID enumeration or third-party access.
- `DirectMessage`: conversation ID, author ID, bounded validated text body, `createdAt`, monotonically sortable stable tie-breaker ID; message-author must be one of the two conversation participants; indexes for bounded cursor pagination. For read receipts, use per-participant `lastReadMessageId/lastReadAt` or a similarly race-safe watermark—**not** fabricated network/device-delivery status.
- Model acceptance/conversation creation atomically and idempotently; parallel requests/acceptance must not duplicate conversations or permit orphaned messages. Enforce FK/uniqueness and query indexes. No plaintext message body in application logs or analytics. Do not promise E2EE or invent key management.
- Preserve Task 010 `FOLLOWERS_ONLY` as non-publishable **until** a separately approved activity audience policy is implemented and tested, even after follows exist. Do not automatically change Task 010 publishing rules.
- Do not silently delete old conversations on a block. Hide/invalidate access according to the approved block policy and document any retention implications.

## 4. Suggested routes (follow repository conventions if equivalent)

**Follow/Wave**

| Method | Route | Meaning |
|---|---|---|
| `POST` | `/v1/users/:userId/follow` | Follow an eligible visible target; idempotent |
| `DELETE` | `/v1/users/:userId/follow` | Unfollow own relationship; idempotent |
| `GET` | `/v1/me/following` | Bounded list of my following, privacy-safe previews |
| `GET` | `/v1/me/followers` | Bounded list of my followers, privacy-safe previews |
| `POST` | `/v1/users/:userId/wave` | Send bounded/idempotent wave; no DM/push implied |
| `GET` | `/v1/me/waves` | Self incoming waves; cursor paginated |

**Message requests and direct conversations**

| Method | Route | Meaning |
|---|---|---|
| `POST` | `/v1/me/message-requests` | `{ "targetUserId": "UUID" }`; create pending contact request, no unsolicited text |
| `GET` | `/v1/me/message-requests` | Self inbox/sent (explicit filter), bounded/cursor |
| `POST` | `/v1/me/message-requests/:requestId/accept` | Recipient-only atomic acceptance + conversation create/get |
| `POST` | `/v1/me/message-requests/:requestId/decline` | Recipient-only refusal without thread creation |
| `GET` | `/v1/me/conversations` | Self-only 1:1 list, last-message preview and accurate unread count; cursor + optional query |
| `GET` | `/v1/me/conversations/:conversationId/messages` | Participant-only, blocked checks, bounded cursor pagination |
| `POST` | `/v1/me/conversations/:conversationId/messages` | Participant-only validated text send after accepted consent; idempotency strategy for retried network calls |
| `POST` | `/v1/me/conversations/:conversationId/read` | Participant-only monotonic read watermark; may return unread count |

Define actual response envelopes `{data,meta:{requestId,...}}`/standard error envelope, exact status codes, predictable pagination, ids, validation, 401/403/404 behavior. Use public-safe User Preview DTO only where authorized; never serialize the raw User/Profile model. If a route naming convention already exists, adapt rather than add duplicate implementations.

**Deliberate exclusions:** group chats (Groups domain not implemented), typing/presence/WebSockets, push notifications, email delivery, image/file messages, E2EE, user reports/moderator dashboard, disappearing chat, voice/video calling, read/delivery fabricated states, Plan Meetup actions. No client-facing success stub for these features. Record them in Flutter handoff as deferred.

## 5. Implementation quality and privacy boundaries

- Make all create/mutate operations bounded, allowlisted, authenticated and derived from current JWT/session identity. Use Zod schemas and existing AppError conventions; reject arbitrary actor IDs, user roles, message authors and server timestamps from payloads.
- Ensure blocks and participant checks are performed at query level where possible and just before action; fail closed on races. Prevent ID-guessing from revealing private conversation/message/request content. Use 404 masking for resources the caller cannot see.
- Use indexed deterministic cursors (createdAt+id, etc.) and enforce hard max limit; avoid offset scan and unbounded `include: { messages: true }`.
- Prevent accidental leaking of forbidden/hidden users through a public follower listing, chat search or message preview. Keep sensitive account data (email, DOB, phone, raw KYC, exact location, media storage paths, schedule timezone) out of all cross-user DTOs.
- Read receipts are user-authorized read acknowledgments, not the server claiming a device received content. Do not let old receipts regress or permit one participant to mark the other's reads.
- Consider durable consistency for unread calculation, concurrent send/list/query and request acceptance; do not report a successful send if transaction fails. Database outages are not `409 CONFLICT` unless an actual known conflict occurred.
- Use explicit, secure text limits and Unicode handling; store ordinary text only, never execute/parse user HTML. Flutter must safely render text. Avoid logging chat bodies, sensitive request payloads, or access tokens.
- Visibility and block rule changes must be respected on subsequent reads. Document the limited guarantee for in-flight requests, and avoid cached unprotected message content.
- Account deletion/retention is still legally deferred. Use safe referential actions; do not implement destructive deletion without the approved account-lifecycle policy.

## 6. Test requirements

**Run now:** `prisma validate`/`generate`, `typecheck`, `lint`, `format:check`, `npm test` and build. Add focused unit coverage: target visibility/blocked permission matrix, follow idempotency, request state transitions, text validation, message serialization allowlist, cursor parsing, read watermark logic, self/disabled account cases.

**Write integration tests** (run only when test PostgreSQL is configured and identity guard passes) for:

1. Eligible follow/unfollow and real follower counts; repeated follow/unfollow requests; forbid self, hidden, blocked, suspended/ineligible targets; A/B privacy and changing D-03 visibility.
2. Wave persistence with no implicit DM/notification, self/hidden/blocked rejection and anti-spam/duplicate behavior.
3. DM request creation, recipient-only accept/decline, unrelated user 404, cross-request races, idempotent repeated accept, refusal abuse protections and no conversation before consent.
4. Message sent/read/list pagination/search/unread accuracy; unauthorized third-party guessed IDs, blocked either direction, post-block no send or content reads, pending account exclusion, no E2EE or device-delivered claims.
5. Two requests concurrently accepting/creating the same conversation; exactly one unordered pair; send failures rollback; retry/idempotency if adopted.
6. Public DTO allowlist (no email/DOB/phone/KYC/raw storage keys/exact meeting instructions); visibility toggles, KYC expiry/revocation target lookups, no secret leaks in errors.
7. Regression for Tasks 006–010 including activity RSVP/KYC/waitlist; full native PostgreSQL suite once configured. Tests may create isolated KYC fixtures through Prisma; **never** add runtime fake approval or provider bypass.

**Critical DB status:** `.env` still has `YOUR_PASSWORD` and native PostgreSQL P1000. Do not pretend any migration or integration run succeeded. Preserve previous databases, use the test DB guard, do not call `migrate reset`, and do not repeatedly start Prisma Dev. Include exact migration and verification status in final report.

## 7. Documentation, decisions and final report

Update `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`, relevant OpenAPI (new `openapi/social.yaml` or repository-consistent schema), `docs/plans/STATUS.md`, `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md`, `docs/product/OPEN_QUESTIONS.md`, and Figma screen traceability. Label routes **implemented in source** versus **integration verified** honestly; provide request and response examples, error codes and pagination.

In one **concise owner decision table**, distinguish approved baseline rules from provisional choices for:
- DM permission and accepted-request requirement; whether mutual follow ever removes the request step.
- Following an `EVERYONE` account versus a `VERIFIED_USERS_ONLY` account, public follower counts, and privacy of follower identities.
- Wave repeat/cooldown/response semantics.
- Whether an already-accepted DM may continue after a profile changes visibility; whether unblock requires a new request.
- Message retention, moderation, reports and abuse handling; no E2EE until a real cryptographic design is separately approved.
- Whether/when `FOLLOWERS_ONLY` activity publication may be activated using the Follow graph.

**Final engineering report**: Exact files, models/migrations, actual routes/DTOs/auth, Figma mapped/deferred features, current tests (numbers and failures), integration gate status, risks/owner decisions and best next Figma section (Groups & Communities). Stop after completing Task 011; do not begin group chats or production integrations as part of this milestone. No commits/pushes/Flutter code/prod changes.
