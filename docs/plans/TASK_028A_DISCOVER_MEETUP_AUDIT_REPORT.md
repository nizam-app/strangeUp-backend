# Task 028A — Discover & Direct Meetup Flow (read-only source audit)

**Date:** 2026-10-29  
**Phase:** **028A COMPLETE** — documentation only; **no implementation authorized**. **STOP before 028B.**  
**Task plan:** `cursor_tasks/StrangeUp_TASK_028_Discover_Meetup_Flow_Source_Audited_Staged_Execution.md`  
**Parity matrix:** `docs/product/FIGMA_DISCOVER_MEETUP_PARITY_TASK028A.md`

---

## 1. Figma PDF verification

All five PDFs exist under `design-reference/task028-discover-meetup/`. Each file is **1 page** (`-- 1 of 1 --` in rendered text). SHA-256 matches `MANIFEST.md` exactly:

| Filename | SHA-256 (verified on disk) | Mapped screen |
|---|---|---|
| `Screen 10_ User Profile.pdf` | `227a05c990a2c1e8a2d128c92da0b453d9365d303feab7c97e5f1e805a939098` | Discover target public profile |
| `Html → Body → iPhone 15 frame simulation (393px width, 852px height).pdf` | `93c8ae23fb6463bffd0b481c97f081f9bc4779c407912caf6cdbb88419763c29` | **Create Meetup** modal |
| `Html → Body.pdf` | `faea7791012e63904f590d6e4e0f9c9190a84a12ecc8eb561db414bd1e1664ac` | **Meetup Invites** inbox |
| `Html → Body-1.pdf` | `3e96ddaf96f99e5a7c1b6fb5aa530b3d461e662b89f1545ddc51dd559cddb015` | **Direct Meetup Invitation** details |
| `Mask group.pdf` | `6ee00aac20196113fcb39b56ec22f496d88647b61dffae18362d1b1bf809caef` | Flow title only (no app UI) |

**Filename collision warning confirmed:** `Html → Body.pdf` / `Html → Body-1.pdf` in this ZIP are **meetup inbox/details**, not Task 027 Activity join-request screens. Identity is by hash + rendered content, not filename alone.

**Observed Figma-only data (DO NOT SHIP as API truth):** `Active 10m ago`, `0.8 miles away`, `100% ID Verified`, `5.0 / 28 reviews`, `1.4k Followers / 14 Meetups`, `3 Mutual`, map thumbnail / Get Directions, `~45 mins chat`, `Public Spot`, precise street address, trust banner (“both profiles passed identity verification”, “Real-time check-in prompts will activate 15 mins prior”), example dates in the past (`Sat, Apr 26, 2025`).

---

## 2. Executive summary

| Question | Answer (source evidence) |
|---|---|
| Does a **personal meetup invitation** domain exist in Prisma? | **No** — no `MeetupInvite` (or similar) model; grep across `prisma/` is empty for meetup invite entities. |
| Are `/v1/meetup-invites` (or equivalent) routes mounted? | **No** — `src/app.ts` mounts discover, users, activities, social, etc.; OpenAPI has **no** meetup-invite paths. Candidates remain in `docs/api/ENDPOINT_CANDIDATES.md` only. |
| Can Flutter create/send/read/accept/decline/reschedule personal invites today? | **No** — `settings-capabilities.ts` exposes `meetupInvites: "DEFERRED"`; integration test expects same (`main-flow-025d.integration.test.ts`). |
| Is this the same as Task **027E** Activity host approval? | **No** — 027E uses `Activity.joinMode`, `ActivityParticipationState` (`PENDING`/`DECLINED`/…), host join-request APIs. Personal meetup is a **separate** product domain (Task 028 plan §0, D-09 ADR scope). |
| What **is** implemented for Discover → profile → social entry? | Task **009** + **025B** discovery/public profile; Task **011** follow/wave/DM request; Task **022** `requireHomeAccess` on main-app routers including `/v1/discover` and `/v1/users`. |

---

## 3. Baseline domains audited (Tasks 009, 011, 022, 023, 025B, 027E)

### 3.1 Discovery & public profile (009, 025B)

- **Routes:** `GET /v1/discover/people` (`discovery.routes.ts`); `GET /v1/users/:userId`, avatar (`public-users.routes.ts`).
- **Gating:** `mountMainApp` applies `authenticate` + `requireHomeAccess` (`app.ts` L118–128) — same Task **022** bar as home/activities.
- **Target eligibility:** `isDiscoverablePublicProfileTarget()` requires trusted KYC + admin `APPROVED` session match (`public-profile-policy.ts`, `discover-target-policy.ts`) — **025B fix** documented in `TASK_025B_DISCOVER_REPORT.md`.
- **Viewer:** `canBrowseDiscovery` → `hasFullAccountAccess`; combined with middleware, viewers hitting discover/profile are activation-gated in practice.
- **Blocks:** `canViewPublicProfile` → generic **404** when blocked either direction.
- **Visibility:** `profileVisibility` `EVERYONE` vs `VERIFIED_USERS_ONLY` (`D-03`).
- **Public profile DTO** (`public-profile.dto.ts`, `public-profile.service.ts`): display name, username, bio, city/region, interests, follower/following counts, `viewerFollows`, `conversationId` if DM accepted — **no** upcoming activities, groups, recent activity, ratings, meetup counts, presence, distance, or “Plan Meetup” capability flag.

### 3.2 Social — Follow, Wave, DM (011)

- **Routes:** under `/v1/users/:userId/*` (`social.routes.ts`): follow, wave, message-requests, conversations/messages.
- **Contact initiation:** `canInitiateSocialContact` → `canViewPublicProfile` — **does not** grant meetup consent (`social-policy.ts` L25–36).
- **DM:** separate `DirectMessageRequest` lifecycle (create / accept / decline); `conversationId` on public profile only when **ACCEPTED**.
- **Rate limits:** follow/wave/request/message per-user limits in `social.controller.ts` via `checkRateLimit` — **no** meetup-specific limits (domain absent).
- **Note:** Social services call `assertFullAccess` (email/age/active); router-level **home access** is stricter and already enforced for `/v1/users`.

### 3.3 Task 022 KYC / admin gate

- **Enforcement:** `createRequireHomeAccessMiddleware` on main-app paths including discover and public/social user routes.
- **Discover targets** must pass `hasHomeAccess` to appear (`isDiscoverablePublicProfileTarget`).
- **Handoff KYC-01 / KYC-ENF-02** (`FLUTTER_DEVELOPER_HANDOFF.md`): sender KYC before send real-world meetup invite; recipient KYC before RSVP accept — **policy documented**, **no meetup send/accept API** to enforce on yet.

### 3.4 Notifications (023)

- **`UserNotificationType` enum** (`schema.prisma` L232–244): message, group membership, activity RSVP/join-request types only — **no** `MEETUP_*` types.
- **Push copy map** (`push-payload.ts`): same set; meetup cards in Figma remain **unsupported**.
- **MDWQ-0506:** Meetup invitation Accept/Decline notification journey — **OWNER_DEFERRED** (D-07); still accurate.
- **Emitter rule:** handoff §13 — only persisted notification rows; **no synthetic meetup events**.

### 3.5 Task 027E (Activity host approval — separate)

- **Delivered:** `ActivityParticipation` with `PENDING`/`DECLINED`, host join-request approve/decline, inventory `view=pending` (`TASK_027E_ACTIVITY_JOIN_APPROVAL_REPORT.md`, D-09).
- **Must not conflate:** Activity `PENDING` ≠ personal meetup invite `PENDING`; accepting Activity join does not create or accept a direct meetup invitation.

### 3.6 Task 027 incomplete phases (honest status)

- **027F:** Attendee roster — **complete** per `STATUS.md` header (2026-10-29).
- **027G+:** **Skipped for Task 027 closure** (027I) — owner-gated; see `TASK_027I_FINAL_VERIFICATION_REPORT.md` (no separate 027G audit doc).
- Starting Task **028** does **not** close remaining Activity/post-membership work.

---

## 4. Repository search — personal meetup functionality

| Search | Result |
|---|---|
| `meetup` in `src/` | Only **group** `meetupFrequency` metadata and `settings-capabilities.meetupInvites: DEFERRED` |
| `MeetupInvite` / `meetup_invite` in `prisma/` | **None** |
| `invitation` / `reschedule` / `checkin` in `src/modules/` | **None** (Activity join uses “join request”, not meetup invitation) |
| OpenAPI `meetup` | **None** |
| Implemented routes vs `ENDPOINT_CANDIDATES.md` `/v1/meetup-invites` | **Candidates only — not implemented** |

**Related but distinct:** `CommunityGroup.meetupFrequency` is display-only group metadata (Task 012). `GET /v1/groups/:id/activities` lists **Activity** cards, not personal invites.

---

## 5. Per-screen parity (summary)

Full control-level matrix: `FIGMA_DISCOVER_MEETUP_PARITY_TASK028A.md`.

| Screen | Overall | Critical gap |
|---|---|---|
| Screen 10 — User Profile | **PARTIAL** | Social entry **MATCHED**; profile enrichment + trust/geo **MISSING/DEFERRED**; **no** Create Meetup API or `capabilities.meetupInvites` beyond DEFERRED |
| Create Meetup (iPhone PDF) | **MISSING** | Entire compose/send contract absent |
| Meetup Invites inbox | **MISSING** | No inbox resource, filters, or mark-read |
| Invitation details | **MISSING** | No detail ACL resource; Accept/Decline/Reschedule unsupported |
| Mask group | **N/A** | Title asset only |

---

## 6. Missing behavior (confirmed gaps)

1. **Create/send** — typed invite (Coffee/Activity/Sports/Other), title, schedule, location granularity, optional note (~200 chars in Figma — **NEEDS DECISION** `MEET-DATETIME` / validation).
2. **Inbox** — Pending/All/Accepted/Declined tabs, pagination, preview cards (privacy: venue/note in list **NEEDS DECISION** `MEET-LOCATION`).
3. **Details read** — recipient-scoped (and sender) with block/KYC recheck on read.
4. **Accept / decline** — idempotent state transitions, concurrency, post-block behavior.
5. **Reschedule** — Figma button only; **no** counter-proposal screens → **OWNER_DEFERRED** (`MEET-RESCHEDULE`).
6. **Notifications** — in-app/push event types and dedupe keys for invite lifecycle.
7. **Anti-spam** — duplicate invites, rate limits, eligibility (`MEET-ELIGIBILITY`, `MEET-MODERATION`).
8. **Outgoing invites** — Figma emphasizes incoming; scope for sender list **NEEDS DECISION**.

---

## 7. Security & privacy audit (028A)

| Invariant | Current state | Risk if UI ships early |
|---|---|---|
| Task 022 gate on new endpoints | N/A — no endpoints | Must apply `requireHomeAccess` + KYC-ENF on all 028C–E routes |
| Recipient/sender-only ACL | No invite rows | ID enumeration, note/address leak via guessed UUIDs |
| Blocks | Blocks hide profile/social | Must re-check on every invite read/action |
| Venue/address in discover/list/push | No invite DTOs | Figma shows full address on detail + partial on inbox — **policy first** |
| No trust fabrication | Profile has no ratings/mutuals/presence | Figma detail trust banner is **DO_NOT_SHIP** without backend |
| Separate from 027E | Activity join APIs exist | Flutter must not call Activity RSVP for personal meetup |
| Idempotency | Social follow/wave use P2002 swallow | Meetup send/accept need explicit dedupe keys / unique constraints |
| Logging | No meetup module | Must not log private notes/addresses when implemented |

**Existing positive patterns to reuse:** `loadVisibleSocialTarget` / `canInitiateSocialContact` for recipient lookup; `PUBLIC_NOT_FOUND_MESSAGE` / `SOCIAL_NOT_FOUND_MESSAGE` anti-enumeration; notification `dedupeKey`; transaction patterns from `activity-host-join-requests.service.ts` (for **Activity only** — do not merge schemas).

---

## 8. Owner decision register (evidence-backed; not approved in 028A)

| Alias | Decision | Default until decided | Queue |
|---|---|---|---|
| **MEET-ELIGIBILITY** | Who may invite whom (discoverable only vs follow/DM rules)? | No create API | MDWQ-0720, D-07 |
| **MEET-LOCATION** | Address precision; show before accept? map/directions? | No precise venue in public APIs | MDWQ-0722, D-04, MDWQ-0401 |
| **MEET-STATE** | States, expiry, withdraw, duplicate re-invite | Document only | MDWQ-0723 |
| **MEET-RESCHEDULE** | Counter-proposal workflow | UI **DEFERRED** | MDWQ-0724 |
| **MEET-DATETIME** | TZ, duration, future window, note max length | No validation rules shipped | MDWQ-0725 |
| **MEET-NOTIFY** | Events, read vs accept state, reminders, check-in copy | No meetup notification types | MDWQ-0506, MDWQ-0725 |
| **MEET-TRUST** | Mutual count, dual-verified banner, check-in promise | **DO_NOT_SHIP** | MDWQ-0407, COPY-TRUST |
| **MEET-RELATION** | Side effects on Activity/DM/group | **Independent resource** | D-09, Task 028 plan |
| **MEET-MODERATION** | Report abusive invite, suspend mid-lifecycle | Deny actions; retention TBD | MDWQ-0607 |

**Figma does not approve these rows.** Owner must lock minimum policy in **028B** before schema/API work.

---

## 9. Proposed bounded implementation phases (recommendation only — not authorized)

Aligned with task plan §5; order assumes 028B owner sign-off:

| Phase | Scope | Preconditions |
|---|---|---|
| **028B** | ADR/decision doc: eligibility, states, venue DTO rules, datetime | Owner picks `MEET-*` minimum |
| **028C** | Additive Prisma model + statuses/indexes; unit tests | 028B recorded |
| **028D** | `POST` create/send + `GET` inbox + `GET` detail; idempotency; block/KYC | MEET-ELIGIBILITY, MEET-LOCATION, anti-spam |
| **028E** | Accept/decline (+ cancel if approved); no Activity/DM side effects | MEET-STATE |
| **028F** | Reschedule negotiation | **Skip** unless MEET-RESCHEDULE approved |
| **028G** | `UserNotificationType` extensions + emitter; safe push payloads | MEET-NOTIFY |
| **028H** | OpenAPI, handoff, parity closure, bounded Neon E2E | Prior phases or explicit deferrals |

**Parallel:** Keep Task **027G–I** on their own track; do not block 028B documentation on 027G, but do not mark Task 027 “all complete” in STATUS/queue.

---

## 10. Documentation updates (028A)

| File | Change |
|---|---|
| `docs/product/FIGMA_DISCOVER_MEETUP_PARITY_TASK028A.md` | **Created** — per-control parity |
| `docs/plans/MASTER_DEFERRED_WORK_QUEUE.md` | **Updated** — Task 028 rows MDWQ-0720–0727; MDWQ-0506 cross-ref |
| `docs/plans/STATUS.md` | **Updated** — 028A audit complete banner |
| `cursor_tasks/StrangeUp_TASK_028_*.md` | **Updated** — 028A status |

**Not changed (no API delta):** `docs/api/CURRENT_APIS.md`, OpenAPI YAML, application source, tests, Prisma.

---

## 11. STOP statement

**028A complete.** No code, migrations, tests, Flutter, production actions, commits, or pushes. **Do not begin 028B** until the owner explicitly requests decision lock-in / contract design.
