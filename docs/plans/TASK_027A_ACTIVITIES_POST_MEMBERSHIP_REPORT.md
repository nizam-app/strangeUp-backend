# Task 027A — After Membership Activities Flow (source verification)

**Date:** 2026-10-29  
**Phase:** 027A only (**documentation** — no application code, migrations, tests, commits, or pushes)  
**Plan:** `cursor_tasks/StrangeUp_TASK_027_After_Membership_Activities_Source_Audited_Staged_Execution.md`

## 1. Objectives completed

1. Confirmed design package **`design-reference/task027-activities-post-membership/`** exists with **five PDFs + MANIFEST.md** (previously absent at the 2026-10-27 Task 010 parity audit).
2. Visually verified screen identity via PDF text extraction (all five files); corrected cross-flow mapping: **`Html → Body-1.pdf` = Join Requests** (not Settings, not `Body-4`).
3. Reconciled Figma vs current backend (Tasks **010**, **022**, **025C**, **026A** preserved; no RSVP or host-approval changes).
4. Documented Join Requests **count contradiction** on-screen (6/10 filled vs Approved 8) without converting to business rules.
5. Published parity matrix, updated master deferred queue, and engineering status trackers.

## 2. Source file evidence

**Folder:** `design-reference/task027-activities-post-membership/`

| File | Screen | Present |
|---|---|---|
| `Screen 12_ Activity Details.pdf` | Activity Details | Yes |
| `Html → Body.pdf` | My Activities | Yes |
| `Screen 13_ Create Activity.pdf` | Create Activity | Yes |
| `Html → Body-1.pdf` | Join Requests | Yes |
| `Mask group.pdf` | Section title | Yes |

**Hash note:** On-disk SHA-256 values **differ** from packaged `MANIFEST.md` section 1 (see `FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027A.md` table). Screen labels and copy were verified directly from PDF content; hashes should be re-recorded if owner designates a single byte-authoritative export.

## 3. Join Requests — capacity copy (exact Figma text)

From `Html → Body-1.pdf` (same activity title as detail screen):

- Header: **“ACTIVITY CAPACITY”**
- **“6 of 10 spots filled”** and **“4 spots left”**
- Segmented controls: **“Pending 5”**, **“Approved 8”**, **“Declined 2”** (also shown as **“Approved (8)”**, **“Declined (2)”**)

**Backend today:** Only **`CONFIRMED`** seats count toward capacity; **`WAITLISTED`** is FIFO when full. There is **no** “Approved” counter distinct from confirmed seats, and **no** declined/pending request states. **Do not** reconcile 6 vs 8 algorithmically — **ACT-CAPACITY / MDWQ-0712** requires owner/product clarification.

## 4. Backend re-audit (read-only)

| Area | Finding |
|---|---|
| Participation states | `CONFIRMED`, `WAITLISTED`, `CANCELLED` — no `PENDING`/`DECLINED` (`prisma/schema.prisma`) |
| Join path | `POST /v1/activities/:id/rsvp` → immediate confirm or waitlist (`activity-rsvp.service.ts`) |
| Self lists | `GET /v1/me/activities` (host), `GET /v1/me/activity-rsvps` (joined/waitlisted) |
| My Activities tabs | **No** single aggregated endpoint; Pending/approval UX **unsupported** |
| Activity detail | Public DTO + restricted meeting; no roster API |
| Create categories | Five seeded slugs (`activity-catalog.ts`); Figma also shows Yoga & Social & Dining |
| 025C | Activated-host filtering on public discovery — unchanged |
| 026A | No activity paywall; D-08 billing deferred |

**Contradiction with prior Task 027 draft audit:** Any claim that Join Requests maps to **`Html → Body-4.pdf`** is **invalid** for this owner ZIP.

## 5. Parity summary (by screen)

| Screen | MATCHED | PARTIAL | MISSING / NEEDS_DECISION | DO_NOT_SHIP / DEFERRED |
|---|---|---|---|---|
| Activity Details | Core event, join, meeting gate, gear/skill | — | Roster See All | Geo, directions, ratings, Superhost, verified % |
| My Activities | Host/join/leave/manage | Upcoming merge, Past filter | Pending tab, Message Group, cancel request | Distance, responder badges |
| Create Activity | Draft, cover, schedule, capacity, waitlist, publish | Category set vs Figma chips | 2h cutoff, Followers Only publish | Map pin, marketing RSVP multiplier |
| Join Requests | — (workflow) | Profile fields for cards | Entire approve/decline queue | Most trust/social metrics on cards |

Full matrix: `docs/product/FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027A.md`.

## 6. Documentation changed (027A)

| Document | Change |
|---|---|
| `docs/product/FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027A.md` | **Added** — authoritative 027A parity matrix |
| `docs/plans/TASK_027A_ACTIVITIES_POST_MEMBERSHIP_REPORT.md` | **Added** — this report |
| `docs/plans/MASTER_DEFERRED_WORK_QUEUE.md` | **Updated** — Task 027 queue rows, MDWQ-0701 source, new MDWQ-0710–0713 |
| `docs/plans/STATUS.md` | **Updated** — 027A completion entry |
| `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md` | **Updated** — Task 027 design evidence pointer |
| `design-reference/task027-activities-post-membership/MANIFEST.md` | **Updated** — on-disk hash verification section |
| `cursor_tasks/StrangeUp_TASK_027_…md` | **Updated** — Phase 027A marked complete |

**Not changed (by design):** `CURRENT_APIS.md`, OpenAPI, Flutter handoff, application source, tests — no API behavior change in 027A.

## 7. Master queue — new / changed items

| ID | Change |
|---|---|
| MDWQ-0701 | Source corrected to Join Requests PDF; status unchanged (**DECISION_REQUIRED**) |
| MDWQ-0710 | **Added** — My Activities unified read model / tab filters (safe 027B candidate) |
| MDWQ-0711 | **Added** — Activity-scoped Message Group (ACT-CHAT) |
| MDWQ-0712 | **Added** — ACT-CAPACITY counter semantics (6/10 vs Approved 8) |
| MDWQ-0713 | **Added** — ACT-CATALOG extra Figma categories |

## 8. Recommended next phase

**027B — My Activities read-model parity (SAFE, INDEPENDENT)** — only if owner approves a bounded read-only aggregation; **must exclude** host-approval Pending until **ACT-APPROVAL** is decided. **Do not** start 027B automatically.

**Blocked without owner decision:** 027E (host approval), 027F (roster), most of 027G (chat, followers, cutoff, catalog seeds).

## 9. STOP statement

Phase **027A** complete per task plan. No code, migrations, tests, commits, or pushes were performed.
