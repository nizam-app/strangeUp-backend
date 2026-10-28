# Header Flow — Final parity matrix (Task 023A–023E)

**Date:** 2026-10-28  
**Evidence:** `cursor_tasks/StrangeUp_TASK_023_Header_Flow_Audit_and_Staged_Execution_UPDATED.md`, `Strange up(header flow).zip` (Screens 14, 16, 17, Notification PDF), backend `src/` through Task **023E**.

**Legend**

| Status | Meaning |
|--------|---------|
| **MATCHED** | Backend (+ documented socket where applicable) supports the control |
| **PARTIAL** | Some behavior exists; gaps documented |
| **MISSING** | No backend contract (do not invent) |
| **DEFERRED** | Explicitly out of scope / owner decision pending |
| **FLUTTER-ONLY** | Client layout/navigation with no missing API |
| **NEEDS DECISION** | Product/policy not approved |

**Global gate (Task 022):** Main app routes under gated `/v1/me/*`, `/v1/home`, Socket.IO handshake, and push registration require trusted ID verification + StrangeUp admin approval + eligibility. Pending onboarding → `403` `ONBOARDING_REQUIRED`. Revoked session → `401`; suspended/deleted → auth/socket disconnect.

---

## 1. Header shell (cross-cutting)

| UI / control | Backend | Socket | Status | Notes |
|--------------|---------|--------|--------|-------|
| Messages badge | `GET /v1/me/messaging/summary` → `displayBadgeCount` | `messaging:summary` (optional refresh) | **MATCHED** | DM + group unread only; requests separate |
| Notifications bell | `GET /v1/home` → `notificationsUnreadCount`; list `GET /v1/me/notifications` | — | **MATCHED** | Separate from messaging badge |
| Groups entry | `GET /v1/groups`, `GET /v1/me/groups` | — | **MATCHED** | Task 012 |
| Profile avatar | `GET /v1/me/profile`, avatar bytes | — | **MATCHED** | Outside Header task core |
| Global search | — | — | **MISSING** | Per-domain `q` only; **NEEDS DECISION** for federated search |
| Online / active dots | — | — | **DEFERRED** | No presence model |
| Bottom nav (Home/Explore/etc.) | Various `/v1/home`, discover, store | — | **PARTIAL** | Header ZIP not full app map; routes exist per module |

---

## 2. Screen 16 — Messages / chat list

| UI / control | REST | Socket | Status | Notes |
|--------------|------|--------|--------|-------|
| Recent threads (1:1) | `GET /v1/me/conversations` | — | **MATCHED** | `unreadCount`, preview |
| Recent threads (group) | `GET /v1/me/group-chats` | — | **MATCHED** | Not `/v1/me/conversations` |
| Requests tab count | `GET /v1/me/messaging/summary` → `messageRequestsPending` | — | **MATCHED** | Not in `displayBadgeCount` |
| Requests list | `GET /v1/me/message-requests?box=inbox&status=PENDING` | — | **MATCHED** | Blocked senders excluded |
| Search conversations | `GET /v1/me/conversations?q=` + group-chats `q` | — | **PARTIAL** | **FLUTTER-ONLY** merge of two lists |
| New chat | `POST /v1/me/message-requests` | — | **MATCHED** | Requires acceptance before DM |
| Open 1:1 | `GET/POST .../conversations/{id}/messages`, `POST .../read` | `messaging:dm_message`, `messaging:dm_read`, `messaging:summary` | **MATCHED** | REST authoritative |
| Open group | `GET/POST /v1/groups/{id}/chat/messages`, `POST .../read` | `messaging:group_message`, `messaging:group_read` | **MATCHED** | ACTIVE member ACL |
| Typing indicator | — | `messaging:typing` (ephemeral) | **MATCHED** | Server TTL stop; not E2EE |
| Mute / archive thread | — | — | **MISSING** | **NEEDS DECISION** |
| Chat photos / attachments | — | — | **DEFERRED** | Text-only messages |

---

## 3. Screen 17 — Direct / group chat thread

| UI / control | REST | Socket | Status | Notes |
|--------------|------|--------|--------|-------|
| Send message | `POST .../messages` + `clientMessageId` | Broadcast after commit | **MATCHED** | Idempotent |
| Read receipts (peer UI) | Watermark via `POST .../read` | `messaging:dm_read` / `group_read` | **PARTIAL** | Read state only; not delivery receipt |
| Block user | `POST /v1/me/blocks` | Eviction + no passive leak | **MATCHED** | Tests T023B-S01 |
| E2EE banner | — | — | **DEFERRED** | Do not claim E2EE |

---

## 4. Screen 14 — Groups

| UI / control | REST | Status | Notes |
|--------------|------|--------|-------|
| Discover / search | `GET /v1/groups?q&category&city&region&privacy&tag` | **MATCHED** | No miles/GPS sort |
| My Groups | `GET /v1/me/groups` | **MATCHED** | |
| Create group | `POST /v1/me/groups` | **MATCHED** | |
| Join / pending | `POST /v1/groups/{id}/join` | **MATCHED** | PUBLIC vs PRIVATE_APPROVAL |
| Approve/decline requests | `GET/POST .../manage`, join-request actions | **MATCHED** | Owner/moderator |
| Group card “next activity” | `GET /v1/groups/{id}/activities` | **PARTIAL** | Flutter composes card |
| Verified Community badge | — | **DEFERRED** | No certification source |
| Distance / miles away | — | **DEFERRED** | City/region only policy |
| Owner → member invitation | — | **DEFERRED** | ≠ join request; **NEEDS DECISION** |

---

## 5. Notifications (Notification PDF)

| Figma / card type | DB `UserNotificationType` | Emitter source | Status | Notes |
|-------------------|----------------------------|----------------|--------|-------|
| Message request | `MESSAGE_REQUEST_RECEIVED` | `message-request.service` | **MATCHED** | |
| Request accepted | `MESSAGE_REQUEST_ACCEPTED` | `message-request.service` | **MATCHED** | |
| New DM | `DIRECT_MESSAGE_RECEIVED` | `conversation.service` | **MATCHED** | Aggregated window |
| Group membership approved/declined | `GROUP_MEMBERSHIP_*` | `group-membership.service` | **MATCHED** | |
| Activity RSVP / waitlist | `ACTIVITY_RSVP_*`, `ACTIVITY_WAITLIST_PROMOTED` | `activity-rsvp.service` | **MATCHED** | |
| Group chat message | — | — | **DEFERRED** | `groupChatEnabled` default false; no in-app emitter |
| Meetup invitation Accept/Decline | — | — | **DEFERRED** | Separate product journey |
| Membership Active / billing | — | — | **DEFERRED** | No Stripe/club billing |
| Identity verification completed (instant) | — | — | **DEFERRED** | Admin activation ≠ provider alone |
| Read one / read all | `PATCH /v1/me/notifications/{id}/read`, `POST .../read-all` | **MATCHED** | |
| Inline accept/decline on card | — | — | **FLUTTER-ONLY** / **DEFERRED** | Domain actions via respective APIs when they exist |
| Navigation `sourceId` | DTO `sourceId` + `type` | **PARTIAL** | Flutter resolves target via authenticated APIs |

**Push (023D–E):** Outbox per notification; preferences enforced; `PUSH_ENABLED=false` default; stale age skip (`PUSH_MAX_NOTIFICATION_AGE_SECONDS`).

---

## 6. Socket.IO security (023B–E)

| Scenario | Behavior | Status | Tests |
|----------|----------|--------|-------|
| Handshake | JWT + Task 022 + account eligible | **MATCHED** | T023B-P01 |
| Session revoked / logout | Disconnect; no DM leak | **MATCHED** | T023B-N03 |
| Block / group leave | No passive message leak | **MATCHED** | T023B-S01/S02 |
| Account suspended while connected | Periodic recheck disconnect; no summary | **MATCHED** | T023D-S01/S02 |
| Admin suspend API → disconnect | `applyAccountRestrictionSideEffects` exported; **no staff suspend writer yet** | **PARTIAL** | T023E-G03 hook smoke; **NEEDS DECISION** for suspend API |
| Redis multi-instance | Startup fail if enabled without adapter | **MATCHED** | redis-startup test |

---

## 7. Real notification event sources (authoritative)

Only these paths create `UserNotification` rows (and push outbox enqueue):

- `message-request.service.ts` — request received/accepted  
- `conversation.service.ts` — direct message received  
- `group-membership.service.ts` — membership approved/declined  
- `activity-rsvp.service.ts` — RSVP/waitlist/promotion  

No synthetic meetup invite, billing, or group-chat message notifications.

---

## 8. Implemented vs missing (summary)

**Implemented (Header-relevant):** Messaging summary, DM/group REST + Socket.IO, message requests, blocks, group discover/join/chat, in-app notifications + read APIs, home bell count, device tokens + preferences, push outbox worker (disabled/mock).

**Missing / deferred (do not ship in UI without backend):** Global search, presence, chat media, meetup invitation cards, owner group invites, verified group badge, distances, mute/archive, platform suspend REST (hook ready), production FCM, Redis socket cluster, full notification inline actions for deferred types.

---

## 9. Test evidence (023E focused; not full Neon regression)

| Suite | Cases |
|-------|-------|
| `messaging-summary.integration.test.ts` | Badge semantics |
| `messaging-socket.integration.test.ts` | Socket + security incl. T023D |
| `push-outbox.integration.test.ts` | Push disabled/enabled mock, stale backlog, dedupe |
| `notification-preference-push.integration.test.ts` | Category opt-out |
| `header-flow-023e.integration.test.ts` | Task 022 gate, home count, restriction hook |
| Unit | `push-payload`, typing expiry, redis startup, etc. |

---

## 10. Production release blockers

1. **Owner authorization** for `PUSH_ENABLED=true` and live Firebase credentials.  
2. **Full isolated Neon regression** + security review (not run in 023E).  
3. **Socket.IO Redis adapter** if horizontal scale required.  
4. **Staff account suspension/deactivation API** wired to `applyAccountRestrictionSideEffects`.  
5. **Product decisions:** group owner invites, meetup notification journey, chat media, notification retention.  
6. Do **not** claim production-ready realtime or push until live authorized verification.

**Flutter:** See `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` §14.5–14.7.
