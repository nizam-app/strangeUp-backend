# Figma parity — Task 029H FINAL (Groups & Jobs flow closure)

**Evidence folder:** `design-reference/task029-groups-jobs/` (`MANIFEST.md`, SHA-256 verified 029A)  
**Backend phases closed:** 029A (audit), 029B–D (groups read/create/manage/membership), 029F (jobs discovery/saved)  
**Skipped for this closure (queue retained):** **029E** (interactive Stories/polls/photo), **029G** (publish, employer delivery, application lifecycle extensions)  
**Status legend:** **IMPLEMENTED** | **PARTIAL** | **MISSING** | **DEFERRED** | **NEEDS_DECISION** | **SOURCE_ERROR** | **FLUTTER_ONLY** | **UNVERIFIED**

**Not claimed:** full Figma parity, production readiness, Jobs catalog publish path, employer ATS/email, geo radius, fabricated metrics.

---

## Package & source authority

| Item | Status | Queue / notes |
|---|---|---|
| Screen PDFs on disk (6 UI + 2 assets) | **IMPLEMENTED** | Hashes in MANIFEST |
| **My Groups** visual (`Html → Body.pdf`) | **UNVERIFIED** | **MDWQ-0910** — bytes duplicate updated Group Details, not All/Joined/Managed/Pending |
| **Group Details design authority** (original vs updated tabs) | **NEEDS_DECISION** | **MDWQ-0911** — do not silently pick one variant |
| `GROUP_COMMUNITY_INTERACTIVE_ENABLED` | **false** (default) | Stories/photo/poll routes **DEFERRED** (029E skipped) |

---

## Consolidated screen matrix

### 1. Group Details — original (`Screen 15_ Group Details - Community.pdf`)

| Control | Backend | Status |
|---|---|---|
| Header, tags, frequency | `GET /v1/groups/:id` | **PARTIAL** | No COPY-TRUST “Active Daily” badge field |
| Member count | ACTIVE membership count | **IMPLEMENTED** |
| Verified badge | — | **DEFERRED** |
| Join / request / leave | Join routes + `myMembership` | **IMPLEMENTED** |
| Posts, comments, likes, pin | Group posts API | **IMPLEMENTED** | Text posts |
| Photo / Poll composer | Task 016 | **DEFERRED** | Flag off |
| Members tab | `GET .../members` | **IMPLEMENTED** | D-03 previews |
| About | Detail DTO | **IMPLEMENTED** |
| Distance / map | — | **DEFERRED** | D-04 |

### 2. Group Details — updated (`Screen 15_ … Stories, Chat & Meetups Update.pdf`)

| Control | Backend | Status |
|---|---|---|
| Stories tab | Stories routes | **DEFERRED** | 029E / D-06 |
| Chat tab | REST + Socket.IO group chat | **IMPLEMENTED** | Text; Task 023 ACL |
| Meetups tab | Linked activities | **IMPLEMENTED** | ≠ Task 028 personal invites |
| Posts / Members / About | (as original) | **IMPLEMENTED** / **DEFERRED** |
| Tab badge counts | — | **MISSING** | **MDWQ-0913** |
| **Which PDF is authoritative** | — | **NEEDS_DECISION** | **MDWQ-0911** |

### 3. My Groups (`Html → Body.pdf` — **SOURCE_ERROR**)

| Expected control | Backend contract | Figma visual parity |
|---|---|---|
| All / Joined / Managed / Pending | `GET /v1/me/groups?view=…` (029B) | **UNVERIFIED** (**MDWQ-0910**) |
| Search mine | `q` on my groups | **IMPLEMENTED** |
| Discover search | `GET /v1/groups?q=` | **IMPLEMENTED** |
| Cancel pending | `DELETE .../join` | **IMPLEMENTED** |
| Tab aggregate counts | — | **MISSING** | **MDWQ-0912** |
| Invite members | — | **MISSING** | **MDWQ-0505** |
| Row distance | — | **DEFERRED** | D-04 |

### 4. Create Group (`Screen 1_ Create Group.pdf`)

| Control | Backend | Status |
|---|---|---|
| Cover upload | `POST .../cover` | **PARTIAL** | 5MB server max vs 10MB copy |
| Name ≤ 60 | `GROUP_NAME_MAX=60` | **IMPLEMENTED** |
| Category / tags / location / about | Create DTO | **IMPLEMENTED** |
| Public vs private approval | `privacy` enum | **IMPLEMENTED** |
| Frequency / optional cap | `meetupFrequency`, `memberCapacity` | **IMPLEMENTED** |
| Create eligibility | Full account + Task 022 | **IMPLEMENTED** |

### 5. Manage Group Dashboard (`Screen 2_ Manage Group Dashboard.pdf`)

| Control | Backend | Status |
|---|---|---|
| Pending requests + approve/decline | Manager routes | **IMPLEMENTED** |
| `pendingRequestCount` | Manage DTO | **IMPLEMENTED** |
| Edit group / member count | `PATCH`, counts | **IMPLEMENTED** |
| Create post | Posts API | **IMPLEMENTED** |
| Archived: block settings/cover/membership ops | 029C–D guards | **IMPLEMENTED** |
| “+12 this wk” / Live Synced / verified | — | **DEFERRED** | **MDWQ-0915** |
| Dedicated recent-activity DTO | Posts list separately | **PARTIAL** |

### 6. Screen 23 — Jobs (`Screen 23_ Jobs.pdf`)

| Control | Backend | Status |
|---|---|---|
| Explore list | `GET /v1/jobs` | **IMPLEMENTED** |
| Search + cursor together | `buildPublishedJobListWhere` (029F) | **IMPLEMENTED** |
| employmentType / workMode / city / region | Query validation | **IMPLEMENTED** |
| Category filter | — | **MISSING** |
| Radius / nearest sort | — | **DEFERRED** | **MDWQ-0903** |
| Featured / partner / applicant counts | — | **DEFERRED** | Do not fabricate |
| Saved tab | `GET /v1/me/saved-jobs` | **IMPLEMENTED** |
| Save / unsave | PUT/DELETE saved-jobs | **IMPLEMENTED** |
| Applications tab (read) | `GET /v1/me/job-applications` | **IMPLEMENTED** |
| Apply submit + consent | `POST .../applications` | **IMPLEMENTED** |
| Employer delivery / progress UI | `NOT_CONFIGURED` | **DEFERRED** | **MDWQ-0902** |
| Publish to explore | DRAFT author only | **PARTIAL** | **MDWQ-0901** — **no HTTP publish** |
| Tab badge counts | — | **DEFERRED** | **MDWQ-0906** |
| Task 022 gate | Home access middleware | **IMPLEMENTED** |

---

## Cross-cutting verification (029H)

| Rule | Status |
|---|---|
| Task 022 activation on groups/jobs | **VERIFIED** (T029B-P03, T029F-P04) |
| Blocks / private visibility / cover bytes | **VERIFIED** (T012-P03, P05, P07) |
| Membership ≠ Activity RSVP ≠ MeetupInvite ≠ Club billing | **VERIFIED** (T012-P08; domain separation in reports) |
| Removed/left members lose posts/chat access | **VERIFIED** (T029D-P03) |
| Remove/leave → Socket group eviction hook | **IMPLEMENTED** in source (`onUserLeftGroup` → `evictUserFromGroupChat`); **no dedicated 029H socket eviction integration case** |
| No live job publish or employer delivery claimed | **VERIFIED** (`job-draft.service` `DRAFT_ONLY`; applications `NOT_CONFIGURED`) |

---

## Remaining gaps by class (post-029H)

| Class | IDs (representative) |
|---|---|
| **Release blocker (source)** | **MDWQ-0910** (My Groups PDF) |
| **Owner decision** | **MDWQ-0911** (Group Details authority), **MDWQ-0901** (job publish), **MDWQ-0905** (application withdrawal/transitions), **MDWQ-0914** (secret groups), **MDWQ-0505** (group invites) |
| **Owner-deferred product (unchanged)** | **MDWQ-0902** (employer delivery), **MDWQ-0903** (jobs geo), D-06 interactive (**029E** skipped) |
| **Optional / polish** | **MDWQ-0912**, **0913**, **0915**, **0906** (tab counts), **MDWQ-0099** (full Neon at release) |

**029E / 029G:** **SKIPPED** for Task 029 closure only — corresponding MDWQ rows **remain open**; features are **not** marked implemented, cancelled, or permanently closed.

---

**Historical phase docs:** `FIGMA_GROUPS_JOBS_PARITY_TASK029A.md` (full 029A matrix), `029C`, `029D`, `029F`.
