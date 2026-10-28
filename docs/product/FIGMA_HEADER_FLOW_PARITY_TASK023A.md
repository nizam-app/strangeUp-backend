# Header Flow — Screen 16 / messaging badges (Task 023A)

**Scope:** REST composition only. Socket.IO, FCM, typing, presence, chat photos, and meetup invitation cards remain **deferred** (Task 023B–023E).

**Gate:** Task 022 — trusted current ID verification + StrangeUp admin activation + email/age/consent eligibility before `GET /v1/me/messaging/summary` (same as other main-app `/v1/me/*` routes after the onboarding split). Pending applicants → `403` `ONBOARDING_REQUIRED`.

## Screen 16 — Messages / Chat List

| UI control | Backend route | Response fields | Gate | Missing / Flutter-only |
|---|---|---|---|---|
| Header Messages icon badge | `GET /v1/me/messaging/summary` | `displayBadgeCount` (= DM + group unread messages) | Main app activated | Client layout; no socket push |
| **Recent** tab list | `GET /v1/me/conversations` + `GET /v1/me/group-chats` | Per-thread `unreadCount`, previews | Same | Merge/sort by `updatedAt` in Flutter |
| **Requests** tab badge | `GET /v1/me/messaging/summary` | `messageRequestsPending` | Same | Tab UI |
| Requests list | `GET /v1/me/message-requests?box=inbox&status=PENDING` | `requests[]` | Same | — |
| Search | `GET /v1/me/conversations?q=` and `GET /v1/me/group-chats?q=` | Filtered lists | Same | Single search bar is client composition |
| New Chat | Navigate to user pickers / `POST /v1/me/message-requests` | — | Same | User picker UI |
| Open 1:1 thread | `GET/POST /v1/me/conversations/{id}/messages`, `POST .../read` | Messages + watermark | Participant + no block | — |
| Open group thread | `GET/POST /v1/groups/{id}/chat/messages`, `POST .../read` | Group messages | ACTIVE member | Not a 1:1 conversation |
| Active / online circles | — | — | — | **NOT IMPLEMENTED** — do not fabricate |
| Notifications bell | `GET /v1/home` → `notificationsUnreadCount` or `GET /v1/me/notifications` | Unread notification rows | Same | Separate from messaging summary |

## Badge semantics (authoritative)

- **`directUnread`:** Sum of unread others’ messages in accepted 1:1 threads (blocked peers excluded).
- **`groupUnread`:** Sum of unread others’ messages in ACTIVE group memberships (blocked message authors excluded).
- **`messageRequestsPending`:** Inbox requests with status `PENDING` (blocked senders excluded). **Not** included in `displayBadgeCount`.
- **No mute/archive model** in backend — counts include all visible threads; if product adds mute later, document new fields explicitly.

## Related Header surfaces (unchanged in 023A)

| Surface | Route | Notes |
|---|---|---|
| Groups (Screen 14) | `GET /v1/groups`, `GET /v1/me/groups` | Task 012 — no change in 023A |
| Notifications PDF | `GET /v1/me/notifications` | Task 013 — meetup invite cards still deferred unless domain event exists |
| Profile avatar | `GET /v1/me/profile`, avatar bytes | Separate flow |

**Evidence:** `cursor_tasks/StrangeUp_TASK_023_Header_Flow_Audit_and_Staged_Execution_UPDATED.md`; tests `tests/integration/messaging-summary.integration.test.ts`.
