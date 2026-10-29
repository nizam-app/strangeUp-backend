# Task 029A — Groups & Jobs Flow: Source Verification and Read-Only Backend Audit

**Date:** 2026-10-29  
**Phase:** **029A ONLY** (documentation / audit — no code, migrations, tests, or feature activation)  
**Plan:** `cursor_tasks/StrangeUp_TASK_029_Groups_Jobs_Flow_Source_Audited_Staged_Execution.md`  
**Governing queue:** `docs/plans/MASTER_DEFERRED_WORK_QUEUE.md`

---

## 1. Executive summary

Task 029 packages **six intended app screens** plus two decorative PDFs. On-disk SHA-256 verification **passes for seven of eight PDF bytes** against `design-reference/task029-groups-jobs/MANIFEST.md`, but reveals a **critical packaging error**: `Html → Body.pdf` is **byte-identical** to `Screen 15_ Group Details — Stories, Chat & Meetups Update.pdf`, **not** the My Groups (All / Joined / Managed / Pending) screen described in the task plan and MANIFEST narrative.

**Backend:** Community groups and jobs are **substantially implemented** from Tasks **012**, **013**, **016** (disabled), **014**, **022**, and **023**. Task 029 Figma **marketing labels** (verified badges, distances, applicant counts, featured jobs, tab badge counts, growth stats) must **not** be synthesized.

**Owner gates before implementation phases:**

1. **Which Group Details PDF is authoritative** — original (Posts / Members / About) vs updated (+ Stories / Chat / Meetups tabs).
2. **Re-supply My Groups source** — current ZIP/repo entry for `Html → Body.pdf` is wrong file.
3. **Jobs publish provenance** — no HTTP publish path; only `DRAFT` author listings + DB-seeded `PUBLISHED` (MDWQ-0901).
4. **Do not enable** `GROUP_COMMUNITY_INTERACTIVE_ENABLED` for Stories/photo/poll parity without D-06 sign-off (MDWQ-0602).

---

## 2. Source verification (PDF inventory)

### 2.1 SHA-256 on disk (2026-10-29)

| Packaged file | SHA-256 (computed) | MANIFEST expected | Match |
|---|---|---|---|
| `Screen 15_ Group Details - Community.pdf` | `4137e6781aa88df23f3f6f30f2fb6541ab99d49ce7b6e92e6be5bff956f4103e` | same | **YES** |
| `Screen 15_ Group Details — Stories, Chat & Meetups Update.pdf` | `475f9255dc35a64745caf46748b5655ef7a3ef8c0e6e9c6ca04c21079342e89d` | same | **YES** |
| `Html → Body.pdf` | `475f9255dc35a64745caf46748b5655ef7a3ef8c0e6e9c6ca04c21079342e89d` | same hash | **YES (bytes)** — **NO (claimed screen)** |
| `Screen 1_ Create Group.pdf` | `b51d485052dd1797dafe6dfbd92d49d904bc57066a9cb2e6120cba1ee677d1a7` | same | **YES** |
| `Screen 2_ Manage Group Dashboard.pdf` | `0183002d0ca05b44dfc25b90421640a6adeaea06d64643678bbadbbc5a7cb4ad` | same | **YES** |
| `Screen 23_ Jobs.pdf` | `b48c92991ef4d8fafd4c7d3d31cf693be6bbdd74caaabd96ec0917ab5ed1eb92` | same | **YES** |
| `Mask group.pdf` | `606a32be70708b6011ac023a6cc90db97baf65bda4e3e1f82f1a44a72401ac3a` | same | **YES** |
| `Container.pdf` | `d4db245f3edd5248bc5b2265d70d938c01b5028aaa27a45035d197176a3d5be4` | same | **YES** |

**Note:** `Html → Body.pdf` and the updated Group Details PDF share **length 2,495,303 bytes** and **identical hash**. Extracted first-page text for both includes *Miami Run Collective*, tabs *Posts / Stories / Chat / Meetups / Members*, and composer *Photo / Post / Activity / Poll* — **not** My Groups tabs.

**MANIFEST.md row for `Html → Body.pdf` is internally inconsistent** (claims My Groups content while citing the updated Group Details archive member and hash). **Do not treat MANIFEST narrative for that row as verified** until owner re-exports.

### 2.2 Rendered screen content (extracted text summary)

| File | Observed UI (evidence) | Actionable screen? |
|---|---|---|
| `Mask group.pdf` | Title “Group and Job Flow” | No — section header |
| `Container.pdf` | No extractable UI text | No — decorative |
| `Screen 15_ Group Details - Community.pdf` | Group header, tags, **Posts / Members / About**, pinned announcement, sample 428 members, “Verified Community”, “Active Daily”, “Joined” | Yes — **original** details variant |
| `Screen 15_ … Stories, Chat & Meetups Update.pdf` | Same group; tabs **Posts / Stories / Chat / Meetups / Members / About**; composer Photo/Activity/Poll | Yes — **updated** details variant |
| `Html → Body.pdf` | **Same as updated Group Details** (duplicate) | **My Groups screen NOT PRESENT in package** |
| `Screen 1_ Create Group.pdf` | Cover upload (10MB copy), name 0/60, category, location, about, tags, public/private, frequency, capacity | Yes |
| `Screen 2_ Manage Group Dashboard.pdf` | Admin console, pending join requests, member counts, “Live Synced”, “+12 this wk”, quick actions, recent activity | Yes |
| `Screen 23_ Jobs.pdf` | Explore / Saved (4) / Applications (2), search, Miami + 10 mi, filters, “28 nearby”, “Nearest”, featured job, salaries, “Official Partner”, applicant counts, Apply Now | Yes |

**Filename discipline:** Task 029 `Html → Body.pdf` must **not** be confused with same-named exports in Tasks 025/027/028 (different folders/hashes).

### 2.3 Group Details design authority — **NEEDS OWNER DECISION**

| Variant | Tabs | Backend alignment |
|---|---|---|
| **Original** (`Screen 15_ … - Community.pdf`) | Posts, Members, About | Text posts, comments, likes, pin, members, about fields — **IMPLEMENTED** (member-gated). No Stories tab API when flag off. |
| **Updated** (`Screen 15_ … Update.pdf`) | + Stories, Chat, Meetups | Chat + linked activities **IMPLEMENTED** (Task 012). Stories/photo/poll **IMPLEMENTED but DISABLED** (`GROUP_COMMUNITY_INTERACTIVE_ENABLED=false`, MDWQ-0602). |

**Audit does not select a winner.** Flutter can ship either tab set if product chooses; backend must not activate deferred tabs without owner approval.

**My Groups screen:** Described in task plan but **missing from verified bytes**. Closest historical evidence: **Screen 14 — Groups** (not in this ZIP; see `docs/product/FIGMA_GROUPS_PARITY_MATRIX_2026-10-27.md`, `FIGMA_HEADER_FLOW_PARITY_TASK023.md`).

---

## 3. Domain boundaries (must preserve)

| Concept | Model / module | Distinct from |
|---|---|---|
| **Community group membership** | `CommunityMembership`, `/v1/groups/*`, `/v1/me/groups/*` | Paid BASIC/CLUB (`membership` module, D-08 deferred billing) |
| **Activity join / host approval** | `ActivityParticipation`, Task 027E, D-09 | Group `PENDING` join rows (`CommunityMembership.status`) |
| **Personal meetup invitation** | `MeetupInvite`, Task 028 | Group “Meetups” tab = **links** to Task 010 `Activity` via `CommunityGroupActivity` |
| **Group chat** | `CommunityGroupMessage`, REST + Socket `messaging:group_message` | Activity-scoped chat (MDWQ-0711, not started) |
| **Jobs application** | `JobApplication`, applicant-only reads | Employer ATS, status workflow, applicant counts (deferred) |

---

## 4. Source-backed Groups API inventory

**Gate:** Bearer + `hasFullAccountAccess` (Task 022 activation). **OpenAPI:** `openapi/groups.yaml`, `openapi/group-content.yaml`. **Policy:** `docs/decisions/D-GROUPS-TASK012.md` (provisional).

### 4.1 Discovery, detail, categories

| Method | Path | Service / evidence |
|---|---|---|
| GET | `/v1/group-categories` | `GroupService.listCategories` — seeded catalog (`group-catalog.ts`) |
| GET | `/v1/groups` | `GroupService.listDiscoverable` — ACTIVE groups; filters `q`, `category`, `city`, `region`, `privacy`, `tag` |
| GET | `/v1/groups/:groupId` | `GroupService.getDetail` — `memberCount`, `myMembership`, `canAccessContent` |
| GET | `/v1/groups/:groupId/cover` | Cover stream; PUBLIC non-member vs member rules (`group-policy.canNonMemberSeeCover`) |

### 4.2 My inventory & create

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/me/groups` | `GroupService.listMine` — query `status` (ACTIVE/PENDING), `role` (OWNER/MODERATOR/MEMBER). Default statuses: ACTIVE + PENDING. **No single “tab counts” endpoint.** |
| POST | `/v1/me/groups` | Atomic create + OWNER membership |
| GET | `/v1/me/groups/:groupId/manage` | `pendingRequestCount`, `visiblePostCount` |
| PATCH | `/v1/me/groups/:groupId` | Manager vs owner field split |
| POST/DELETE | `/v1/me/groups/:groupId/cover` | Sharp pipeline; **5MB** server limit (Figma shows 10MB) |

### 4.3 Membership & moderation

| Method | Path | Notes |
|---|---|---|
| POST/DELETE | `/v1/groups/:groupId/join` | `GroupMembershipService` — row lock `FOR UPDATE`; PUBLIC→ACTIVE; PRIVATE_APPROVAL→PENDING; DECLINED/REMOVED→PENDING reapply |
| GET | `/v1/groups/:groupId/members` | D-03 previews; blocks redact |
| GET | `/v1/me/groups/:groupId/join-requests` | Manager only |
| POST | `.../join-requests/:memberId/approve` | Capacity-safe; notifications `GROUP_MEMBERSHIP_*` |
| POST | `.../join-requests/:memberId/decline` | |
| POST | `.../members/:userId/remove`, `.../role`, `.../transfer-ownership`, `.../archive` | Owner/mod rules per `group-policy.ts` |

### 4.4 Posts, feed, chat, meetups (non-interactive media)

| Method | Path | Flag / status |
|---|---|---|
| GET/POST/PATCH/DELETE | `/v1/groups/:groupId/posts` (+ pin, comments, like) | **IMPLEMENTED** — text + optional `activityId` on create |
| GET/POST | `/v1/groups/:groupId/chat/messages`, POST `.../chat/read` | **IMPLEMENTED** |
| GET | `/v1/me/group-chats` | Previews + unread |
| GET/POST/DELETE | `/v1/groups/:groupId/activities`, `/v1/me/groups/:groupId/activities` | Link Task 010 activities (not Task 028 invites) |
| GET | `/v1/me/community-feed` | Task 013 cross-group text feed |

### 4.5 Task 016 — stories, photo posts, polls

| Routes under `/v1/groups/:groupId/...` | `GROUP_COMMUNITY_INTERACTIVE_ENABLED` | Production |
|---|---|---|
| stories, post media, polls, content-reports | default **false** → `403 FEATURE_DISABLED` | Blocked by `production-env-policy.ts` |

**Prisma:** `CommunityGroup`, `CommunityMembership`, `CommunityPost`, `CommunityGroupMessage`, `CommunityGroupActivity`, `CommunityGroupMedia`, `CommunityGroupStory`, `CommunityPoll`, etc. (`prisma/schema.prisma`).

### 4.6 Tests (existing, not re-run in 029A)

| File | Scope |
|---|---|
| `tests/integration/groups.integration.test.ts` | Core group flows |
| `tests/group-policy.test.ts`, `group.validation.test.ts`, `group-query.test.ts`, `group.dto.test.ts`, `group-cover-storage.test.ts` | Unit |
| `tests/integration/group-content.integration.test.ts` | Flag-gated content |
| `tests/group-content.policy.test.ts` | Policy |

---

## 5. Source-backed Jobs API inventory

**Gate:** `assertJobsAccess` → same `hasFullAccountAccess` as groups. **OpenAPI:** `openapi/jobs.yaml`. **Prisma:** `JobListing`, `SavedJob`, `JobApplication`.

| Method | Path | Implementation | Status |
|---|---|---|---|
| GET | `/v1/jobs` | `JobDiscoveryService.listJobs` — **PUBLISHED**, `closedAt` null; filters `q`, `employmentType`, `workMode`, `city`, `region`; sort **createdAt desc** (not nearest) | **IMPLEMENTED** |
| GET | `/v1/jobs/:jobId` | Detail + `applicationStatus` OPEN/CLOSED | **IMPLEMENTED** |
| POST | `/v1/jobs/:jobId/applications` | Cover message + consent version; status `SUBMITTED`; `employerDelivery.status=NOT_CONFIGURED` | **IMPLEMENTED** (minimal) |
| GET/PUT/DELETE | `/v1/me/saved-jobs` | Idempotent save/unsave | **IMPLEMENTED** |
| GET | `/v1/me/job-applications`, `.../:applicationId` | Applicant-only | **IMPLEMENTED** |
| POST/GET/PATCH | `/v1/me/job-listings` | **DRAFT only**; explicit `publishingStatus: DRAFT_ONLY` message | **IMPLEMENTED** (non-public) |

**Not in source:** HTTP publish/close job listing, employer review of applications, withdrawal mutation (enum `WITHDRAWN` exists, no route), resume upload, job category taxonomy, featured/partner flags, distance/radius (D-04 / MDWQ-0903), applicant counts.

**Tests:** `tests/integration/store-jobs.integration.test.ts`, `tests/job.validation.test.ts` (not re-run in 029A).

---

## 6. Feature flags & deferrals (unchanged)

| Flag / contract | Default | Task 029 impact |
|---|---|---|
| `GROUP_COMMUNITY_INTERACTIVE_ENABLED` | false | Stories/photo/poll routes and DTO enrichment off |
| Home `stories.status` | DEFERRED | MDWQ-0601 |
| Jobs `employerDelivery` | NOT_CONFIGURED | MDWQ-0902 |
| Billing / Club | D-08 OWNER_DEFERRED | Unrelated to group join |
| D-04 geo radius | NOT_STARTED | Group/job distance UI |
| COPY-TRUST badges | NOT_STARTED | Verified Community, Official Partner, Active Meetup Host on jobs |

---

## 7. Security and data-integrity notes

| Risk | Severity | Evidence / mitigation |
|---|---|---|
| **Private groups discoverable** | Medium (policy) | `PRIVATE_APPROVAL` listed in `GET /v1/groups` by design (`D-GROUPS-TASK012` GRP-DISC). Non-members get summary + `canAccessContent: false`; content routes 404. Confirm product intent vs “hidden group” expectation. |
| **Pending membership leakage** | Low | User sees own PENDING in `GET /v1/me/groups`; join-request lists manager-only. |
| **Block vs membership** | Medium | Blocks do **not** auto-remove membership; content from blocked users omitted in feeds/chat lists. Managers can still approve pending requests from blocked users (documented GRP-BLOCK). |
| **Capacity races** | Low | Join/approve uses `FOR UPDATE` on group row + seat checks. |
| **Job application PII** | Medium | `coverMessage` stored; no resume pipeline; no employer access API — reduces exposure but retention/consent policy still needed (JOB-02). |
| **Duplicate applications** | Low | `@@unique([jobListingId, applicantUserId])` → 409. |
| **Disabled interactive media** | Low | Fail-closed 403 prevents accidental prod activation; production policy throws if flag true. |
| **Fabricated metrics** | High if shipped | Figma counts/badges/distances **must not** be API fields without authoritative sources. |

---

## 8. Reconciliation with MASTER_DEFERRED_WORK_QUEUE

**Existing rows still authoritative:** MDWQ-0505 (group invites), 0510 (group chat push), 0601–0607 (stories/home/trust), 0608 (groups core **COMPLETED**), 0901–0904 (jobs), 0701/0714 (activity join — **do not conflate** with group joins).

**New / updated rows (029A):** see §10 of `MASTER_DEFERRED_WORK_QUEUE.md` (MDWQ-0910–0915).

---

## 9. Recommended conditional implementation phases (post–owner review)

| Phase | Scope | Precondition |
|---|---|---|
| **029B** | My Groups / discover read parity, tab filtering docs, pagination, activation/block handling | Owner supplies **correct My Groups PDF**; confirm Screen 14 vs dedicated inventory UX |
| **029C** | Create/manage form gaps only (cover limit messaging, category list) | Source-confirmed gaps only |
| **029D** | Membership policy tweaks (cooldown, waitlist) | **Owner policy** if Figma requires beyond current GRP-* rules |
| **029E** | Stories/photo/poll/chat/meetups | **Default SKIP**; D-06 + MDWQ-0602 for interactive; chat/meetups already live for text/links |
| **029F** | Jobs read parity | **JOB-01** publish path; no fake listings |
| **029G** | Application lifecycle | JOB-02, withdrawal, employer roles — explicit approval |
| **029H** | Closure + regression | MDWQ-0099 release gate |

**029A STOP:** No 029B work started.

---

## 10. Owner decision checklist (029A)

- [ ] **GRP-DETAILS-01:** Authoritative Group Details — **original** vs **updated** tab set (or phased Flutter with deferred tabs hidden).
- [ ] **GRP-SOURCE-01:** Re-export and replace **`Html → Body.pdf`** with true **My Groups** screen; update MANIFEST SHA-256.
- [ ] **GRP-DISC-01:** Confirm **PRIVATE_APPROVAL** groups remain **discoverable summaries** (current backend) vs unlisted/secret groups.
- [ ] **GRP-INVITE-01:** Owner-initiated member invites (MDWQ-0505) — in or out of MVP?
- [ ] **D-06:** Approve or reject production activation of group stories/photo posts/polls (MDWQ-0602).
- [ ] **JOB-01 / MDWQ-0901:** Who publishes `PUBLISHED` listings (staff, seed, future API)?
- [ ] **JOB-02 / MDWQ-0902:** Employer delivery, application statuses beyond `SUBMITTED`, withdrawal API.
- [ ] **JOB-03 / MDWQ-0903:** Distance filter and “nearest” sort (D-04).
- [ ] **COPY-TRUST:** Verified Community, Official Partner, featured jobs, applicant counts — **omit** until policy exists.

---

## 11. Release blockers (029A perspective)

| Blocker | Class |
|---|---|
| Missing My Groups source asset in Task 029 package | **SOURCE** — MDWQ-0910 |
| Group Details design authority unset | **DECISION** — MDWQ-0911 |
| Jobs catalog empty in prod without publish workflow | **DECISION/OPS** — MDWQ-0901 |
| D-06 interactive group media off while updated Figma shows Stories/Poll/Photo | **EXPECTED DEFERRAL** — not a backend bug |
| MDWQ-0099 full Neon regression | **RELEASE_BLOCKER** (unchanged) |

---

## 12. Commands executed (029A)

| Command | Result |
|---|---|
| SHA-256 all files in `design-reference/task029-groups-jobs/` | Hashes listed §2.1 |
| Python `pypdf` first-page text extraction | Screen summaries §2.2 |
| Source grep/read: `src/modules/groups/*`, `group-content/*`, `jobs/*`, `prisma/schema.prisma`, `CURRENT_APIS.md`, prior parity docs | Inventory §4–5 |

**Not executed:** typecheck, unit/integration tests, migrations, production operations.

---

**Deliverables:** this report; `docs/product/FIGMA_GROUPS_JOBS_PARITY_TASK029A.md`; MANIFEST correction note; MDWQ updates; STATUS entry for 029A audit complete.
