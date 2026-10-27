# Figma Groups parity matrix — Task 012 (2026-10-27)

**Evidence:** Phase 0 PDF inventory + task screen list. Local `design-reference/` currently holds the people-discovery PDF only; group PDFs remain **Original ZIP only** (`FIGMA_EXPORT_VERIFICATION_2026-10-26.md`). Labels below are `PRIOR-EXPORT-REPORTED` unless a local PDF is re-opened.

| PDF / screen | Control / state | Backend effect | Verified vs inferred | Status |
|---|---|---|---|---|
| Screen 14 — Groups | Search, category, city/region, My Groups, Create, Join | `GET /v1/groups`, `GET /v1/me/groups`, `POST /v1/me/groups`, `POST /v1/groups/:id/join` | Observed in Phase 0 | **LIVE in source** |
| Screen 14 | Miles away / Active Daily presence / sample member counts | — | Observed marketing | **DO NOT SHIP** |
| Screen 14 | Verified Community badge | — | Observed example | **DO NOT SHIP** — no backend flag |
| Screen 1 — Create Group | Name (60), about, category, tags, city/region, public/private, frequency, capacity, cover | `POST /v1/me/groups` + cover upload | Observed | **LIVE in source** |
| Screen 1 | Geocoding / auto meetups / free-form unlimited tags | — | Not evidenced as policy | **DEFER** |
| Screen 2 — Manage Group | Pending requests, counts, edit, posts | `/v1/me/groups/:id/manage`, join-request approve/decline, PATCH | Observed | **LIVE in source** |
| Screen 2 | Live Synced / growth stats | — | Observed example | **DO NOT SHIP** |
| Screen 15 — Group Details | About, members, posts, pinned, comments, likes, join status | Detail + member/post/comment/like APIs | Observed | **LIVE in source** (member-gated content) |
| Screen 15 | Sample 428-member list / verified wristband | — | Observed example | **DO NOT SHIP** |
| Screen 15 update — Chat | Group chat tab | `/v1/groups/:id/chat/*`, `/v1/me/group-chats` | Observed | **LIVE in source** (text + watermark) |
| Screen 15 update — Meetups | Linked meetups | `GET /v1/groups/:id/activities` + attach/detach | Observed | **LIVE in source** (real Activity IDs only) |
| Screen 15 update — Stories / Photo / Poll | Composer extras | — | Observed | **DEFER** |
| Screen 08 update | My Groups / group feed reuse | Existing list/post APIs are reusable | Observed | **PARTIAL** — no dedicated Home Dashboard API |
| Screen 16 | Group thread preview / unread | `/v1/me/group-chats` | Observed | **LIVE in source** |
| Screen 16 | 5 users online / E2EE / typing | — | Observed marketing | **DO NOT SHIP** |
