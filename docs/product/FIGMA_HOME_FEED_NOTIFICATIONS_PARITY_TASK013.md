# Figma parity — Home Dashboard, Community Feed & Notifications (Task 013)

**Updated:** 2026-10-27  
**Evidence:** Screen 08 Home Dashboard (+ Community & Stories Update), Html → Notification.pdf, Screen 14/15 group context.

| Figma control / section | Backend | Status |
|---|---|---|
| Greeting / location header | Client-only; server exposes profile `locationCity`/`locationRegion` via existing `/v1/me/profile` | **LIVE (existing)** |
| Search / nav chrome | Client-only | N/A |
| **Community Stories (24h)** | No story storage or expiry APIs | **NOT IMPLEMENTED** — D-06 provisional; `GET /v1/home` returns `stories.status: DEFERRED` |
| My Groups row | `GET /v1/home` → `myGroups` (Task 012 `MyGroupDto`, ACTIVE only) | **LIVE — integration verified** |
| Latest joined-group posts | `communityFeedPreview` + `GET /v1/me/community-feed` | **LIVE — integration verified** |
| Post media / polls / shares | Text posts only (Task 012) | **DEFERRED** |
| Upcoming group meetup card | `upcomingGroupActivities` (linked Task 010 public cards; no meeting instructions) | **LIVE — integration verified** |
| People Near You | `people` via Task 009 discovery (no geo/distance ranking) | **LIVE — integration verified** |
| Activities Near You | `activities` upcoming public list (no nearest ranking) | **LIVE — integration verified** |
| Recommended For You | `featured.groups` + `featured.activities` (recent discoverable lists; **not** ML) | **LIVE — labeled featured, not personalized** |
| Notifications bell / unread | `notificationsUnreadCount` + `/v1/me/notifications` | **LIVE — integration verified** |
| Notification inbox Today/Earlier grouping | Client groups by `createdAt`; server returns cursor-sorted list | **LIVE (client layout)** |
| Mark all as read | `POST /v1/me/notifications/read-all` | **LIVE — integration verified** |
| Meetup invitation / activity reminder / KYC success / group invitation cards | Only events with real hooks (message request, DM, group approve/decline, RSVP states) | **PARTIAL** — see event table in handoff |
| Push / email delivery | Pull inbox only | **NOT IMPLEMENTED** |
| Online / active-now / verified badges | Not exposed | **NOT IMPLEMENTED** |

**Owner decisions still OPEN:** story audience & retention, notification retention/delete policy, cross-group pin ordering, D-06 groups social policy.
