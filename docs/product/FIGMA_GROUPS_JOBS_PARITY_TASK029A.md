# Figma parity — Task 029A (Groups & Jobs flow)

**Evidence folder:** `design-reference/task029-groups-jobs/`  
**Verified:** 2026-10-29 (SHA-256 + first-page text extraction)  
**Backend evidence:** `src/modules/groups/*`, `src/modules/group-content/*`, `src/modules/jobs/*`, `docs/api/CURRENT_APIS.md`  
**Status legend:** **IMPLEMENTED** | **PARTIAL** | **MISSING** | **DEFERRED** | **NEEDS_DECISION** | **FLUTTER_ONLY** | **SOURCE_ERROR**

---

## Package integrity

| Item | Status |
|---|---|
| 8 PDF files on disk | **IMPLEMENTED** (inventory complete) |
| MANIFEST SHA-256 vs bytes | **PARTIAL** — hashes match, but **`Html → Body.pdf` content ≠ MANIFEST “My Groups” claim** → **SOURCE_ERROR** |
| My Groups screen (All/Joined/Managed/Pending) | **SOURCE_ERROR** — **not present** in package; duplicate of updated Group Details |

---

## Screen matrix

### A. `Screen 15_ Group Details - Community.pdf` (original)

| Control / state | Backend | Status | Notes |
|---|---|---|---|
| Group header (name, location, tags, frequency label) | `GET /v1/groups/:id` | **PARTIAL** | No “Active Daily” badge field; `meetupFrequency` enum only |
| Member count | `memberCount` (ACTIVE rows) | **IMPLEMENTED** | Truthful count; not “428” sample |
| Verified Community badge | — | **DEFERRED** | MDWQ-0605; never returned |
| Joined / Join / Request state | `myMembership`, join routes | **IMPLEMENTED** | |
| Tab: Posts | `GET/POST .../posts`, comments, likes, pin | **IMPLEMENTED** | Text posts; member-gated |
| Pinned announcement | `POST .../pin` | **IMPLEMENTED** | |
| Composer: Photo / Poll | Task 016 routes | **DEFERRED** | Flag off → 403 |
| Composer: Activity attach | `POST .../posts` with `activityId` | **PARTIAL** | Requires pre-linked activity |
| Tab: Members | `GET .../members` | **IMPLEMENTED** | D-03 previews |
| Tab: About | Fields on detail DTO | **IMPLEMENTED** | `description`, location, privacy |
| Share post / engagement counts | like/comment counts on posts | **IMPLEMENTED** | No “share” API |
| Distance / map | — | **DEFERRED** | D-04 |

### B. `Screen 15_ Group Details — Stories, Chat & Meetups Update.pdf` (updated)

| Control / state | Backend | Status | Notes |
|---|---|---|---|
| Tab: Stories | `GET/POST .../stories` | **DEFERRED** | MDWQ-0602; disabled |
| Tab: Chat | `GET/POST .../chat/messages`, `/v1/me/group-chats`, Socket | **IMPLEMENTED** | Text; no E2EE/presence |
| Tab: Meetups | `GET .../activities`, attach/detach | **IMPLEMENTED** | Task 010 cards; ≠ Task 028 invites |
| Tab: Members / About / Posts | (same as original) | **IMPLEMENTED** / **DEFERRED** | Posts text live; photo/poll deferred |
| Badge counts on tabs (e.g. Chat 5, Meetups 3) | — | **FLUTTER_ONLY** or **MISSING** | No tab-badge aggregate API |
| **Design authority vs original** | — | **NEEDS_DECISION** | MDWQ-0911 |

### C. `Html → Body.pdf` (claimed My Groups — **SOURCE_ERROR**)

**Visual parity: UNVERIFIED** (MDWQ-0910 — PDF still duplicates updated Group Details as of 029B).

| Expected (task plan) | Backend | Status |
|---|---|---|
| All / Joined / Managed / Pending tabs | `GET /v1/me/groups?view=all\|joined\|managed\|pending` (029B) | **IMPLEMENTED** (contract); **Figma UNVERIFIED** |
| Tab badge counts | — | **MISSING** | MDWQ-0912 |
| Search groups | `GET /v1/groups?q=` (discover) or client filter on mine | **PARTIAL** |
| Cancel pending request | `DELETE /v1/groups/:id/join` | **IMPLEMENTED** |
| Invite members | — | **MISSING** | MDWQ-0505 |
| Open group / Manage / Members | Existing routes | **IMPLEMENTED** |
| Distance on rows | — | **DEFERRED** | D-04 |

**Use Screen 14 / header parity docs for My Groups until owner re-supplies PDF.**

### D. `Screen 1_ Create Group.pdf`

| Control | Backend | Status |
|---|---|---|
| Cover upload (JPG/PNG, 10MB copy) | `POST /v1/me/groups/:id/cover` | **PARTIAL** | **5MB** server max |
| Group name 60 chars | `GROUP_NAME_MAX=60` | **IMPLEMENTED** |
| Category | `POST /v1/me/groups` + categories catalog | **IMPLEMENTED** | 5 slugs vs Figma “Running” examples |
| Location city/region | optional fields | **IMPLEMENTED** | No geocode |
| About / tags | description + tags (max 5) | **IMPLEMENTED** |
| Public vs Private (approval) | `privacy` PUBLIC / PRIVATE_APPROVAL | **IMPLEMENTED** |
| Meetup frequency | WEEKLY / ACTIVE_DAILY / BIWEEKLY | **IMPLEMENTED** |
| Member cap toggle | `memberCapacity` optional | **IMPLEMENTED** |
| Who may create | `hasFullAccountAccess` | **IMPLEMENTED** | Not CLUB-gated |

### E. `Screen 2_ Manage Group Dashboard.pdf`

| Control | Backend | Status |
|---|---|---|
| Pending join requests list + approve | join-requests routes | **IMPLEMENTED** |
| Member count | manage + detail | **IMPLEMENTED** |
| Edit group | `PATCH /v1/me/groups/:id` | **IMPLEMENTED** |
| Create post / announcements | posts API | **IMPLEMENTED** |
| Pending count on dashboard | `pendingRequestCount` | **IMPLEMENTED** |
| “+12 this wk” / Live Synced / verified | — | **DEFERRED** | COPY-TRUST |
| Activity feed count “14 new posts” | `visiblePostCount` only | **PARTIAL** | No weekly delta |
| Recent activity list | posts list (separate call) | **PARTIAL** | No dedicated “recent activity” DTO |

### F. `Screen 23_ Jobs.pdf`

| Control | Backend | Status |
|---|---|---|
| Explore listings | `GET /v1/jobs` | **IMPLEMENTED** | Empty DB valid |
| Saved tab + count | `GET /v1/me/saved-jobs` | **PARTIAL** | No tab count endpoint |
| Applications tab + count | `GET /v1/me/job-applications` | **PARTIAL** | No tab count endpoint |
| Search text | `q` on title/description/company | **IMPLEMENTED** (029F: `q`+`cursor` — see `FIGMA_GROUPS_JOBS_PARITY_TASK029F.md`) |
| Location + 10 mi radius | city/region only | **DEFERRED** | MDWQ-0903 |
| Category filter (Sports & Fitness) | — | **MISSING** | No job category model |
| Work type filters | `employmentType`, `workMode` | **IMPLEMENTED** |
| Sort nearest | createdAt desc | **DEFERRED** | D-04 |
| “28 nearby” / featured / Official Partner | — | **DEFERRED** | COPY-TRUST / JOB-01 |
| Salary on card | `pay` object + disclaimer | **IMPLEMENTED** | Self-reported |
| Applicant count “14 applicants” | — | **DEFERRED** | Privacy / JOB-01 |
| Apply Now | `POST /v1/jobs/:id/applications` | **IMPLEMENTED** | In-platform; no external URL flow |
| Application progress / employer status | `employerDelivery NOT_CONFIGURED` | **DEFERRED** | MDWQ-0902 |
| User/post job to explore | draft only | **PARTIAL** | MDWQ-0901 |

### G. Supporting assets

| File | Status |
|---|---|
| `Mask group.pdf` | **FLUTTER_ONLY** (section title) |
| `Container.pdf` | **FLUTTER_ONLY** (decorative) |

---

## Cross-task references (read-only)

| Task | Relevance to 029 |
|---|---|
| **012** | Groups core — primary implementation |
| **013** | Home `myGroups`, community feed |
| **014** | Jobs + store; Screen 23 jobs parity baseline |
| **016** | Stories/photo/poll — disabled |
| **022** | Activation gate on all routes |
| **023** | Group chat socket + messaging summary |
| **025** | Main flow tab 4 Jobs entry; Screen 14 not in 029 ZIP |
| **027** | Activity join requests — **not** group joins |
| **028** | Personal meetups — **not** group meetup tab semantics |

---

## Suggested Flutter honesty (no backend change in 029A)

- Hide or mark **DEFERRED** tabs: Stories, photo/poll composer, distances, badges, job featured/partner/applicant counts.
- My Groups tabs: compose from `GET /v1/me/groups` filters until tab-count API or source screen is approved.
- Group Details: pick **one** Figma variant after **GRP-DETAILS-01**; do not enable deferred tabs when API returns `403 FEATURE_DISABLED`.

**029B (complete):** My Groups **read inventory** via `view` + `q` on `GET /v1/me/groups` — see `TASK_029B_GROUPS_READ_INVENTORY_REPORT.md`. **Figma My Groups screen remains UNVERIFIED.**

**Next backend phase:** **029C** only after owner review (not started).
