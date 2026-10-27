# Figma → API parity matrix (Task 011 — Social)

**Inspection date:** 2026-10-27  
**Sources:** `Screen 10_ User Profile.pdf`, `Screen 09_ Discover/Nearby People.pdf`, `Screen 16_ Messages/Chat List.pdf`, `Screen 17_ Chat Conversation.pdf`, `Screen 08_ Home Dashboard.pdf`. Activity/profile PDFs in `design-reference/` were used as available; Screen 16/17 were not in the 13-file local package.  
**Policy:** D-03/D-04, blocks, `D-SOCIAL-TASK011.md`.

Legend: **IMPLEMENTED** = coded; **DB PENDING** = not run on native PostgreSQL; **DEFER** / **DO NOT SHIP**.

## Screen 10 — User Profile

| Control | API | Status |
|---|---|---|
| Follow / Unfollow | `POST/DELETE /v1/users/:userId/follow` | **IMPLEMENTED** / **DB PENDING** |
| Follower count | `followerCount` / `followingCount` on authorized public profile | **IMPLEMENTED** (DB-backed) |
| Wave | `POST /v1/users/:userId/wave` | **IMPLEMENTED** |
| Message | `POST /v1/me/message-requests` then conversation after accept | **IMPLEMENTED** |
| Ratings / ID verified badge / distance | — | **DO NOT SHIP** |

## Screen 09 — Nearby People

| Control | API | Status |
|---|---|---|
| Say Hi / Wave / Follow / Message | Same social routes; target must pass D-03 + blocks | **IMPLEMENTED** |
| Map / miles / presence | — | **DEFER** |

## Screen 16 — Chat list

| Control | API | Status |
|---|---|---|
| Recent 1:1 chats | `GET /v1/me/conversations` | **IMPLEMENTED** |
| Search | `q` on counterpart displayName/username | **IMPLEMENTED** |
| Unread | `unreadCount` from watermark | **IMPLEMENTED** |
| Incoming requests | `GET /v1/me/message-requests?box=inbox` | **IMPLEMENTED** |
| ACTIVE CIRCLES / group chats / push | — | **DEFER** / **DO NOT SHIP** |

## Screen 17 — Conversation

| Control | API | Status |
|---|---|---|
| 1:1 text | `GET/POST /v1/me/conversations/:id/messages` | **IMPLEMENTED** |
| Server timestamps | `createdAt` | **IMPLEMENTED** |
| Read acknowledgment | `POST .../read` watermark | **IMPLEMENTED** |
| Pagination | cursor | **IMPLEMENTED** |
| “Verified & End-to-End Encrypted” | — | **DO NOT SHIP** |
| Typing, photos, Plan Meetup, device delivered | — | **DEFER** |
