# Figma → API parity — Task 027I FINAL (After Membership Activities)

**Phase:** 027I — authoritative closure matrix  
**Date:** 2026-10-29  
**Design package:** `design-reference/task027-activities-post-membership/` (manifest hashes in `MANIFEST.md`)  
**Prior matrices:** `FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027A.md` (027A baseline; superseded where noted below)  
**Decisions:** D-09 hybrid join (**Accepted**); ACT-ROSTER conservative policy (**Implemented** 027F)  
**Verification:** `docs/plans/TASK_027I_FINAL_VERIFICATION_REPORT.md`

**Not claimed:** Full Figma product parity, production readiness, geo/maps, trust marketing metrics, activity group chat, lifecycle push/in-app notifications (027H), followers-only publish, 2h cutoff, extra categories, billing.

## Classification legend

| Tag | Meaning |
|---|---|
| **MATCHED** | Approved backend behavior supports Figma intent |
| **PARTIAL** | Client merge, honest omission, or mode-specific UX |
| **DEFERRED** | Owner-deferred or explicit MDWQ gate |
| **FLUTTER_ONLY** | Layout/copy without server backing |
| **DO_NOT_SHIP** | Must not invent server metrics or claims |
| **SKIPPED_027G** | Task 027 phase G — owner decision required; not in approved scope |
| **SKIPPED_027H** | Task 027 phase H — ACT-NOTIFY not authorized |

## Approved-scope feature matrix (backend)

| Capability | Status | Evidence |
|---|---|---|
| AUTO instant RSVP + FIFO waitlist | **LIVE** | `activity-rsvp.service.ts`; 027e T027E-01, T027E-SEC-05/06 |
| HOST_APPROVAL pending / approve / decline / withdraw | **LIVE** | D-09; join-requests APIs; 027e **11** Neon tests |
| Approved-waitlist FIFO promotion | **LIVE** | `hostApprovedAt` + `tryPromoteHead`; T027E-SEC-05 |
| Capacity + concurrent approvals | **LIVE** | Row locks; T027E-SEC-01, SEC-07 |
| My Activities inventory + `view=pending` + counts | **LIVE** | 027b + 027e; MDWQ-0710, 0714 |
| Attendee roster (CONFIRMED-only, host or participant) | **LIVE** | 027f; MDWQ-0704, 0717 |
| Create / edit / publish / cancel + manage locks | **LIVE** | Task 010 + 027d audit; T027D-M01/M02 |
| Host discoverability (025C) on list/detail/cover/meeting/new RSVP | **LIVE** | 027c; T025C-P01; T027C-P01 |
| Saved activities visibility filter | **LIVE** | 027d; MDWQ-0715; T027D-S01 |
| Meeting-location privacy | **LIVE** | `canAccessMeetingDetails`; 027c/027e meeting 403/404 |
| Personal meetup invitations (Task 028) | **Separate domain** | `/v1/meetup-invites/*` — not Activity join-requests |

---

## Screen 12 — Activity Details

| UI element / action | API / behavior | Status |
|---|---|---|
| Title, schedule, category, description, gear/skill | `GET /v1/activities/:id` | **MATCHED** |
| Public venue text | Public location fields | **MATCHED** |
| Directions / distance / route miles | — | **DEFERRED** D-04 (MDWQ-0401) |
| Capacity / spots remaining | `confirmedCount`, `capacity` (CONFIRMED seats only) | **MATCHED** |
| Exact meet spot | `GET …/meeting` (host or eligible CONFIRMED + KYC) | **MATCHED** |
| Join Activity | `POST …/rsvp` — **AUTO** instant confirm/waitlist; **HOST_APPROVAL** → PENDING | **MATCHED** (mode-dependent) |
| Attendee faces + See All (N) | `GET …/participants?preview=true`; N = `confirmedCount` | **MATCHED** (027F; host not in roster list — compose host in UI) |
| 100% verified attendees / Superhost / ratings | — | **DO_NOT_SHIP** (MDWQ-0407) |
| Host social proof stats | D-03 host preview only | **PARTIAL** |
| Activity payments / tickets | — | **DEFERRED** (MDWQ-0707) |

---

## My Activities (`Html → Body.pdf`)

| UI element / action | API / behavior | Status |
|---|---|---|
| Upcoming / Hosting / Joined / Waitlisted / Past | `GET /v1/me/activity-inventory?view=…` + `includeCounts` | **MATCHED** |
| Pending (host approval) tab | `view=pending`; `relationship=PENDING_APPROVAL` | **MATCHED** (027E; HOST_APPROVAL activities only) |
| Cancel pending request | `DELETE …/rsvp` on PENDING row | **MATCHED** |
| View / Leave / Manage | detail, RSVP delete, host manage routes | **MATCHED** |
| Message Group | — | **SKIPPED_027G** (MDWQ-0711 ACT-CHAT) |
| Distance / marketing chips | — | **DO_NOT_SHIP** / **FLUTTER_ONLY** |
| Host cancel notifications | — | **SKIPPED_027H** (MDWQ-0706) |

---

## Screen 13 — Create Activity

| UI element / action | API / behavior | Status |
|---|---|---|
| Draft, cover, fields, publish, cancel | `/v1/me/activities/*` | **MATCHED** |
| Join mode (AUTO vs host approval) | `joinMode` on draft; locked after publish | **MATCHED** (D-09) |
| Max size + waitlist | `capacity`, `waitlistEnabled` | **MATCHED** |
| Verified-only (real-world KYC) | Server KYC-ENF; not client-toggle bypass | **MATCHED** |
| Yoga / Social & Dining categories | Partial catalog (5 slugs) | **SKIPPED_027G** (MDWQ-0713) |
| Followers Only audience | Stored; publish blocked | **SKIPPED_027G** (MDWQ-0702) |
| 2-hour edit/cancel footer | Not enforced | **SKIPPED_027G** (MDWQ-0703) |
| Map pin refine | — | **DEFERRED** D-04 |

---

## Join Requests (`Html → Body-1.pdf`)

| UI element / action | API / behavior | Status |
|---|---|---|
| Pending queue + Approve / Decline | `GET/POST …/join-requests/*` when `joinMode=HOST_APPROVAL` | **MATCHED** (027E) |
| Approved waitlist tab | `join-requests?status=waitlisted` (host-approved FIFO queue) | **MATCHED** |
| Declined history | `join-requests?status=declined` | **MATCHED** |
| Header “6/10 filled” vs tab “Approved (8)” | Use `hostParticipationSummary` + `confirmedCount` — **not** Figma fiction | **PARTIAL** (MDWQ-0712) |
| Pending card trust metrics (%, mutual, distance) | D-03 preview only where applicable | **PARTIAL** / **DO_NOT_SHIP** |
| Reapply after decline | **409** `declined_reapply_unresolved` | **PARTIAL** (MDWQ-0719 — policy open) |
| Push/in-app on new request or decision | — | **SKIPPED_027H** (MDWQ-0706) |

**Distinction (Task 028):** Personal **Meetup Invitations** (`/v1/meetup-invites`) are **not** Activity Join Requests. Flutter must not route Join Requests UI to meetup invite APIs.

---

## Skipped phases (Task 027 closure)

| Phase | Scope | Queue retention |
|---|---|---|
| **027G** | ACT-CHAT, ACT-FOLLOW, ACT-CUTOFF, ACT-CATALOG | MDWQ-0711, 0702, 0703, 0713 remain **open** |
| **027H** | ACT-NOTIFY lifecycle notifications | MDWQ-0706 remains **open** |

---

## Owner decisions still open (non-blocking for 027 closure)

See `MASTER_DEFERRED_WORK_QUEUE.md` § Activities (MDWQ-0702–0707, 0711–0713, 0718–0719) and cross-cutting MDWQ-0099 (full Neon regression at release).
