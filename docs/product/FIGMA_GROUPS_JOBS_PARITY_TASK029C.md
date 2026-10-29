# Figma parity — Task 029C (Create Group & Manage Group Dashboard)

**Evidence:** `Screen 1_ Create Group.pdf`, `Screen 2_ Manage Group Dashboard.pdf` (`design-reference/task029-groups-jobs/`)  
**Backend:** Task 012 create/manage routes (unchanged surface area except archived mutation guard)  
**Legend:** **IMPLEMENTED** | **PARTIAL** | **DEFERRED** | **NEEDS_DECISION** | **FLUTTER_ONLY**

---

## Screen 1 — Create Community Group

| Figma control | Backend | Status | Notes |
|---|---|---|---|
| Group name 0/60 | `POST /v1/me/groups` `name` max 60 | **IMPLEMENTED** | |
| About the community | `description` optional, max 500 | **PARTIAL** | Figma shows long copy; not required server-side |
| Cover photo (JPG/PNG, 10MB, 16:9) | `POST /v1/me/groups/:id/cover` after create | **PARTIAL** | **5MB** re-encode limit; second step after `201` create |
| Primary category (Running, Coffee, …) | Managed slugs: sports, fitness, outdoor, social, hobbies | **PARTIAL** | No free-form Figma labels; **do not invent** categories |
| Base location city/region | `locationCity`, `locationRegion` | **IMPLEMENTED** | No geocode / map |
| Tags & interests | `tags` max 5, normalized tokens | **IMPLEMENTED** | |
| Public — open join | `privacy: PUBLIC` | **IMPLEMENTED** | Immediate ACTIVE join |
| Private — approval required | `privacy: PRIVATE_APPROVAL` | **IMPLEMENTED** | PENDING until approve |
| Meetup frequency | `meetupFrequency` enum | **IMPLEMENTED** | Display metadata only |
| Member capacity toggle | `memberCapacity` optional, min 2 max 500 | **IMPLEMENTED** | |
| Who may create | Task 022 `hasFullAccountAccess` | **IMPLEMENTED** | Not CLUB-gated (D-08 billing deferred) |

---

## Screen 2 — Manage Group Dashboard

| Figma control | Backend | Status | Notes |
|---|---|---|---|
| Edit group details & bio | `PATCH /v1/me/groups/:id` | **IMPLEMENTED** | Mod: core fields; owner: privacy/capacity |
| Real member count | `memberCount` ACTIVE rows | **IMPLEMENTED** | |
| Pending join requests | `GET .../join-requests`, `pendingRequestCount` on manage | **IMPLEMENTED** | |
| Approve / decline | `POST .../approve`, `.../decline` | **IMPLEMENTED** | Capacity + row lock |
| Owner / moderator manage view | `GET /v1/me/groups/:id/manage` | **IMPLEMENTED** | Members → 404 |
| Visible post count | `visiblePostCount` on manage DTO | **IMPLEMENTED** | Not “14 new this week” |
| Create post / announce | `POST /v1/groups/:id/posts` | **IMPLEMENTED** | Text only; interactive media **DEFERRED** |
| Live Synced / Verified Community | — | **DEFERRED** | MDWQ-0605, COPY-TRUST |
| +12 this wk / growth stats | — | **DEFERRED** | MDWQ-0915 |
| Recent activity timeline (RSVPs, comments) | — | **DEFERRED** | No manage-feed aggregate API |
| Custom quick-action menu | — | **FLUTTER_ONLY** | Routes map to existing APIs |

---

## 029C code fix (archived groups)

| Mutation | Before 029C | After 029C |
|---|---|---|
| `PATCH /v1/me/groups/:id` on ARCHIVED | Allowed | **403** archived |
| Cover upload/delete on ARCHIVED | Allowed | **403** archived |
| `GET .../manage` on ARCHIVED | Allowed (read) | Unchanged |

Aligns with posts/chat rejecting non-ACTIVE groups.

---

## Cross-references

- My Groups inventory: Task **029B** (`view` query) — Figma still **UNVERIFIED** (MDWQ-0910).
- Group Details tabs: **MDWQ-0911** open.

**029D not started.**
