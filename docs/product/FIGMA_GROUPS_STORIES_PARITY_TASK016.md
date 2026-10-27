# Figma parity — Group stories, photo posts & polls (Task 016)

Evidence: `Screen 15_ Group Details — Stories, Chat & Meetups Update.pdf`, `Screen 08_ Home Dashboard — Community & Stories Update.pdf`.

| Figma control | Backend (2026-10-27 Task 016) | Status |
|---|---|---|
| Posts tab + text posts | Task 012 `/v1/groups/:id/posts` | **LIVE** (Neon verified Tasks 006–015 regression) |
| Composer “Photo” on post | `POST .../posts/:postId/media` | **IMPLEMENTED, DISABLED** (`GROUP_COMMUNITY_INTERACTIVE_ENABLED=false`; D-06 provisional) |
| Composer “Poll” | `POST .../posts/:postId/poll`, vote `PUT .../poll/vote` | **IMPLEMENTED, DISABLED** (same gate) |
| Stories tab / 24h label | `GET/POST .../stories`, media `GET .../stories/:id/media` | **IMPLEMENTED, DISABLED**; read-time expiry enforced in code |
| Home “COMMUNITY STORIES” row | `GET /v1/home` → `stories.status: DEFERRED` | **NOT LIVE** — unchanged until owner approves D-06 |
| Personal “Your Story” | — | **DEFERRED** (D06-04) |
| View counts / presence / E2EE | — | **NOT IMPLEMENTED** |
| Production CDN / cron expiry worker | Local disk + manual cleanup script | **DEV_ONLY** |
