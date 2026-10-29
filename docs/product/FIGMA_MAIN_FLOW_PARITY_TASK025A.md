# Main Flow Figma parity — Task 025A (Home / main-shell baseline)

**Date:** 2026-10-28  
**Evidence:** All nine PDFs under `design-reference/task025-main-flow/` (see `MANIFEST.md`).  
**Scope:** Phase **025A only** — shared Home/main-shell API contract; Screen 09 source correction recorded; **025B–025E not started**.

**Main-app gate (Task 022, ADR-005):** All five tabs require **trusted provider KYC + StrangeUp admin approval** on the same session (`requireHomeAccess` on `/v1/home`, discover, activities, groups, store, jobs, membership, and gated `/v1/me/*`). Pending users → `403 ONBOARDING_REQUIRED` or `403 ACCOUNT_NOT_ACTIVATED` with `nextAction`. This **supersedes** older “browse before government ID” copy in legacy KYC task docs.

**Legend:** MATCHED | PARTIAL | DEFERRED | FLUTTER-ONLY | NEEDS DECISION

---

## Screen 09 — Discover / Nearby People (source correction)

| Figma control | Backend (today) | Status |
|---|---|---|
| List / Map toggle | No map or geo APIs | **FLUTTER-ONLY** (map UI) / **DEFERRED** (D-04) |
| Search people or activities | `GET /v1/discover/people?q=` (people only on this route) | **PARTIAL** — activities search is `/v1/activities` (025C) |
| Within 5 mi / nearest / distance | City/region profile fields only | **DEFERRED** (D-04) — do not invent miles |
| Today / activity / age / verified filters | Not on discover query | **DEFERRED** (025B + owner) |
| Nearest first / active counts | Not exposed | **DEFERRED** (D-04 / COPY-TRUST) |
| Nearby People (N active) | No server “active peer” count | **FLUTTER-ONLY** — no `142 Active Peers` API |
| Profile card / View Profile | `GET /v1/users/{userId}` | **MATCHED** (ACL + blocks) |
| Say Hi / Wave | `POST /v1/users/{userId}/waves` | **MATCHED** (Task 011) |
| ID Verified labels on cards | No verification badge field on previews | **DEFERRED** (COPY-TRUST) |

---

## Screen 08 — shared sections (both PDF variants)

Present on **original** and **Community & Stories Update** exports:

| Figma section / action | Backend | Status |
|---|---|---|
| Location header (“Miami, FL”) | `GET /v1/me/profile` → `locationCity` / `locationRegion` | **MATCHED** (viewer profile; not geo-GPS) |
| “142 Active Peers” / marketing counts | — | **FLUTTER-ONLY** — not a server metric |
| Global search (“Find people, activities or groups”) | No unified search API | **DEFERRED** — use tab-specific lists |
| People Near You + See All | `GET /v1/home` → `people`; full list `GET /v1/discover/people` | **MATCHED** — no distance on DTO |
| Say Hi / Connect on cards | Wave/follow/message via social routes on `userId` | **MATCHED** |
| Activities Near You + Map | `GET /v1/home` → `activities`; `GET /v1/activities` | **PARTIAL** — no map/miles (025C) |
| Join Activity | `POST /v1/activities/{id}/rsvp` (Task 010) | **MATCHED** |
| Recommended For You / Community Spotlight | `GET /v1/home` → `featured.groups`, `featured.activities` | **PARTIAL** — recent discoverable lists, not ML |
| Verified meetups marketing / gshield | Policy gates on join/host; no badge DTO | **PARTIAL** |
| Notifications bell | `GET /v1/home` → `notificationsUnreadCount`; inbox `/v1/me/notifications` | **MATCHED** |
| Bottom nav five tabs | Gated route mounts per module | **MATCHED** |

---

## Screen 08 — Community & Stories Update **only** (HOME-08)

| Figma section / action | Backend | Status |
|---|---|---|
| Community Stories 24h row | `GET /v1/home` → `stories.status: "DEFERRED"` | **DEFERRED** (D-06) |
| Your Story / story circles | — | **DEFERRED** (D-06; `GROUP_COMMUNITY_INTERACTIVE_ENABLED=false`) |
| Your Groups / Manage | `GET /v1/home` → `myGroups` | **MATCHED** |
| Group update hints (“3 new posts”, “Active 1h ago”) | Member counts partial; **no** post-count or presence on home DTO | **PARTIAL** / **FLUTTER-ONLY** for presence |
| Latest From Your Groups / Filter Feed | `communityFeedPreview`; paginated `GET /v1/me/community-feed` | **MATCHED** (text posts; filter = `groupId` query) |
| Upcoming group meetup card | `upcomingGroupActivities` (linked public activity cards) | **MATCHED** — no meeting instructions on home |
| Post likes/comments/share UI | Task 012 text posts; rich engagement | **PARTIAL** |

**Owner decision HOME-08:** Which Screen 08 variant is MVP-authoritative is **unresolved**. Backend serves **superset** fields; Flutter may hide deferred/empty sections.

---

## Main-shell header badges (not on `/v1/home` body)

| Surface | API | Status |
|---|---|---|
| Messages tab badge | `GET /v1/me/messaging/summary` → `displayBadgeCount` | **MATCHED** (Task 023) |
| Message requests badge | same → `messageRequestsPending` | **MATCHED** |
| Notification bell | `GET /v1/home` → `notificationsUnreadCount` | **MATCHED** |

Do **not** merge notification count into messaging badge (documented in handoff).

---

## Other ZIP screens (out of 025A implementation scope)

| PDF | Phase |
|---|---|
| Screen 11 Activity Discovery | 025C |
| Screen 20 Marketplace | 024A–D live; checkout **UNAVAILABLE** |
| Screen 26 Profile & Settings | 025D |
| Html → Body (Edit Personal Details) | 025D |
| Link - Tab 4 Jobs (ACTIVE) | Jobs routes `/v1/jobs` (Task 014) — tab chrome only here |

---

## Open owner decisions (unchanged)

| ID | Topic |
|---|---|
| HOME-08 | Authoritative Home variant |
| D-04 | Precise geo, radius, map, last-active |
| D-06 | Stories activation |
| COPY-TRUST | Verified badges, ratings, active peer counts |
| MKT-03 / D-08 | Club pricing / checkout |
