# Figma → API parity — Task 027A (After Membership Activities Flow)

**Phase:** 027A — source verification & reconciliation (**documentation only**)  
**Inspection date:** 2026-10-29  
**Design package:** `design-reference/task027-activities-post-membership/`  
**ZIP source name:** `Strange up(after member ship activities flow).zip`  
**Execution plan:** `cursor_tasks/StrangeUp_TASK_027_After_Membership_Activities_Source_Audited_Staged_Execution.md`

**Policy precedence (unchanged):** KYC-01/03/05, KYC-ENF-01..05, Task 022 `requireHomeAccess`, D-03/D-04, `D-ACTIVITIES-TASK010.md`, Task 025C host eligibility, Task 026A D-08 billing deferral.

**Closure (027I):** Authoritative four-screen matrix → `FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027I_FINAL.md`. Sections below retain 027A history; rows marked MISSING for ACT-APPROVAL/roster were delivered in 027E/F unless still tagged DEFERRED/SKIPPED.

**Prior audit correction:** In **this** ZIP, **`Html → Body-1.pdf` = Join Requests** (not Settings, not `Body-4`). **`Html → Body.pdf` = My Activities**.

## Source verification summary

| File | Verified screen (visual + text extract) | Packaged manifest SHA-256 | On-disk SHA-256 (2026-10-29) |
|---|---|---|---|
| `Screen 12_ Activity Details.pdf` | Activity Details | `90fae305…` | `60c86146dbe05ed2cfb11ee86a9599649c2c4e7b7a8e2a2d2889a7db3c19ec4d` |
| `Html → Body.pdf` | My Activities | `e03150f4…` | `4925d944f803b8269d35f296a7f86b6bad6b198e3d5ce96419161dc39a1a030a` |
| `Screen 13_ Create Activity.pdf` | Create Activity | `93ffb0a6…` | `1b8c24b9419edb4b5f801a18d621cf14225bb9e05c5a0938dd27d65860c3e022` |
| `Html → Body-1.pdf` | **Join Requests** | `1c192161…` | `95621a81ea5fe01ff449bbd67975f2cdf71e3599e293d0a79f2a3173992cdb81` |
| `Mask group.pdf` | Section title “After Membership / Activities Flow” | `649a7edf…` | `e43e73eba8a9c30e3a576d766e20e476805da0acc5dfb5e9525c28028e1fcb7c` |

All **five** PDFs are present under the expected folder. **Byte hashes do not match** section 1 of `MANIFEST.md` (likely re-export or PDF producer metadata drift). **Screen identity is confirmed by extracted on-screen copy**, not by hash alone. Do not substitute similarly named exports from other Figma flows.

**Related baseline (preserved, not re-opened):** Task 010 discovery/detail/create (`FIGMA_ACTIVITIES_PARITY_MATRIX_2026-10-27.md`, Screen 11 in main flow); Task 025C discovery host filter (`TASK_025C_ACTIVITIES_REPORT.md`).

## Classification legend

| Tag | Meaning |
|---|---|
| **MATCHED** | Backend behavior matches Figma intent within approved policy |
| **PARTIAL** | Core data exists; client must merge, omit, or use honest placeholders |
| **MISSING** | No API/workflow for the Figma action |
| **DEFERRED** | Owner-deferred or explicit D-* / MDWQ gate |
| **FLUTTER_ONLY** | Layout/marketing with no server claim required |
| **NEEDS_DECISION** | Product rule required before implementation |
| **DO_NOT_SHIP** | Figma trust/geo/social metrics must not be invented server-side |

---

## Mask group — After Membership / Activities Flow

| Element | Backend | Status |
|---|---|---|
| Section title card | N/A (nav/marketing) | **FLUTTER_ONLY** |

---

## Screen 12 — Activity Details (`Screen 12_ Activity Details.pdf`)

| UI element / action | API / source | Status |
|---|---|---|
| Title, category chips (“Biking • Social”) | `GET /v1/activities/:activityId` — `title`, `category` | **MATCHED** |
| Schedule (date, start/end, timezone) | `startsAt`, `endsAt`, `scheduleTimeZone` | **MATCHED** |
| Public venue / starting location text | `venueName`, `venueAddress`, city/region fields | **MATCHED** (no map pin) |
| “Directions” | — | **DEFERRED** (D-04 / MDWQ-0401) |
| “1.2 mi away” | — | **DO_NOT_SHIP** / **DEFERRED** (D-04) |
| Capacity: “4 spots remaining (12/16 filled)” | `capacity`, `confirmedCount`, derived spots | **MATCHED** (counts from DB `CONFIRMED` only) |
| Description, tags (“Ocean Breeze”, etc.) | `description`; tag chips | **FLUTTER_ONLY** (no tag model) |
| “8.4 miles total” route distance | — | **DO_NOT_SHIP** |
| Required gear / pace & skill | `gearNotes`, `skillNotes` | **MATCHED** |
| “Meet by the Clock Tower” exact spot | `GET /v1/activities/:activityId/meeting` (host or eligible **CONFIRMED** participant) | **MATCHED** |
| Confirmed attendee avatars + “See All (12)” | `GET /v1/activities/:id/participants` (`preview=true`, pagination); **N** = `confirmedCount` | **MATCHED** (027F conservative — host or CONFIRMED participant only) |
| “100% ID Verified Attendees…” banner | KYC trust is per-user, not aggregate attendee % | **DO_NOT_SHIP** |
| Host block (name, bio quote) | D-03 host preview + blocks | **MATCHED** (no Superhost) |
| Host “14 Meetups Attended”, “100% ID Verified”, “5.0”, “28 reviews” | — | **DO_NOT_SHIP** (COPY-TRUST / MDWQ-0407) |
| “Superhost”, “Host since 2023”, “100% Attendance Rate” | — | **DO_NOT_SHIP** |
| “Free” pricing | No activity payments in scope | **MATCHED** (no ticket API) |
| “Open RSVP” + **Join Activity** | `POST /v1/activities/:activityId/rsvp` → instant **CONFIRMED** or **WAITLISTED** | **MATCHED** (not host-approval mode) |

---

## My Activities (`Html → Body.pdf`)

**027B update (2026-10-29):** Re-inspected `Html → Body.pdf` — tabs Upcoming / Hosting / Joined / Pending (approval); Past label on list.

**027C update (2026-10-29):** Public detail/cover/meeting/new-RSVP aligned when host loses activation; inventory self-list retained with redacted host preview where policy requires.

| UI element / action | API / source | Status |
|---|---|---|
| Tabs: Upcoming, Hosting, Joined, Waitlisted, Pending (approval) | `GET /v1/me/activity-inventory?view=…` + optional `includeCounts`; `view=pending` (027E) | **MATCHED** (027B/027E) |
| Legacy dual fetch | `GET /v1/me/activities?when=…`, `GET /v1/me/activity-rsvps?when=…&participation=…` | **MATCHED** (extended filters) |
| “Past” section label | `GET /v1/me/activity-inventory?view=past` | **MATCHED** (027B) |
| Card: category, title, schedule, venue, host preview | Public/host card fields on list DTOs | **MATCHED** |
| “12 of 16 joined”, “8 of 12 joined”, “6 of 10 spots” | `confirmedCount` / capacity on activity embed | **MATCHED** |
| “1.2 mi away”, “Mats provided”, “Fast responder” | — | **DO_NOT_SHIP** / **FLUTTER_ONLY** |
| **View Activity** | `GET /v1/activities/:id` or host detail | **MATCHED** |
| **Leave Activity** | `DELETE /v1/activities/:id/rsvp` | **MATCHED** |
| **Message Group** | Community group chat is separate module (Task 012); not activity-scoped | **MISSING** / **NEEDS_DECISION** (ACT-CHAT / MDWQ-0711) |
| **Manage Activity** (hosting) | `GET/PATCH /v1/me/activities/:id`, publish/cancel | **MATCHED** |
| “6 confirmed guests” (host card) | Count `CONFIRMED` participations for host’s activity | **MATCHED** (host can derive from detail or future read helper) |
| **Join requested** / **Request Pending** / **Cancel Request** | `HOST_APPROVAL` → PENDING; withdraw via `DELETE …/rsvp` | **MATCHED** (027E / D-09) for approval mode; AUTO activities unchanged |
| “Host approval required” (Padel card) | Set `joinMode=HOST_APPROVAL` on draft | **MATCHED** when host selects approval mode — **WAITLISTED ≠ approval pending** |
| “Host reviews requests within 12h” | — | **DO_NOT_SHIP** (policy copy until ACT-APPROVAL + ACT-NOTIFY) |

---

## Screen 13 — Create Activity (`Screen 13_ Create Activity.pdf`)

**027D update (2026-10-29):** Backend validators and host manage rules audited — draft/publish/cancel, capacity floor, schedule lock with participants, cover scoping **MATCHED**; FOLLOWERS_ONLY publish, 2h cutoff, Yoga/Social categories **NEEDS_DECISION** (unchanged).


| UI element / action | API / source | Status |
|---|---|---|
| Draft / Cancel | `POST /v1/me/activities` (DRAFT), abandon via client | **MATCHED** |
| 16:9 cover | `POST/GET/DELETE /v1/me/activities/:id/cover` | **MATCHED** (prod CDN separately gated) |
| Name, description (500) | Create/patch allowlist | **MATCHED** |
| Categories: Biking, Padel & Tennis, Running, Swimming, **Yoga**, **Social & Dining** | Seed catalog: biking, padel-tennis, running, swimming, **fitness** — no yoga/social-dining slugs | **PARTIAL** / **NEEDS_DECISION** (ACT-CATALOG / MDWQ-0713) |
| Date & start/end time + timezone | `startsAt`, `endsAt`, `scheduleTimeZone` | **MATCHED** |
| Search area / venue + exact meeting instructions | Public venue fields + private `meetingInstructions` | **MATCHED** |
| “Refine Pin” map | — | **DEFERRED** (D-04) |
| Max group size, enable waitlist | `capacity`, `waitlistEnabled` | **MATCHED** |
| “Only Allow Verified Members” toggle | Server enforces KYC-ENF on real-world join/host paths; toggle is **not** a weakening switch | **MATCHED** policy / **FLUTTER_ONLY** as authority |
| Audience: Public (Nearby) / **Followers Only** | `audience=PUBLIC` publishable; `FOLLOWERS_ONLY` stored but not publishable | **PARTIAL** (ACT-FOLLOW / MDWQ-0702) |
| “High Trust” badge | — | **FLUTTER_ONLY** |
| Footer: edit/cancel up to **2 hours** before meetup | Not enforced server-side | **NEEDS_DECISION** (ACT-CUTOFF / MDWQ-0703) |
| “3.2x more RSVPs” cover hint | — | **DO_NOT_SHIP** |
| **Publish Activity** | `POST /v1/me/activities/:id/publish` + KYC for real-world | **MATCHED** |

---

## Join Requests (`Html → Body-1.pdf`) — **not** Settings / **not** Body-4

| UI element / action | API / source | Status |
|---|---|---|
| Screen title “Join Requests” | — | Figma-only host moderation UX |
| Activity capacity header: **“6 of 10 spots filled”** + **“4 spots left”** | `confirmedCount` vs `capacity` (CONFIRMED seats) | **MATCHED** *if* “filled” = confirmed seats |
| Tab counts: **Pending 5**, **Approved 8**, **Declined 2** | `hostParticipationSummary` + join-requests lists — not Figma fiction | **PARTIAL** (027E; MDWQ-0712) |
| **Capacity contradiction (document only):** header shows **6/10 filled** while **Approved (8)** appears in the same frame | — | **NEEDS_CLARIFICATION** (ACT-CAPACITY / MDWQ-0712) — **do not** derive occupancy from “Approved” chip counts |
| Pending cards: interests, mutual connections, meetup counts, ratings, “100% Verified”, distance, “12m ago” | Public profile + discovery fields partially exist; many metrics absent | **PARTIAL** / **DO_NOT_SHIP** for ungrounded stats |
| **Approve** / **Profile** on pending rows | `POST …/join-requests/:userId/approve\|decline` | **MATCHED** (027E) |
| Approved row: “Added to ride roster”, “Spot #6 confirmed”, “Message David” | CONFIRMED after approve; roster via `GET …/participants`; DM separate (Task 011) | **PARTIAL** (roster 027F; no activity-scoped group chat) |
| Bottom nav | Client shell | **FLUTTER_ONLY** |

**Engineering note (updated 027E):** ACT-APPROVAL **approved** (D-09). Backend supports **`HOST_APPROVAL`** join mode and host review APIs. Use **`hostParticipationSummary`** for counters — **not** Figma’s contradictory “6/10 filled” vs “Approved (8)” example (MDWQ-0712). **`WAITLISTED`** remains capacity FIFO, distinct from **`PENDING`** host approval.

---

## Preserved baselines (Tasks 010 / 022 / 025C / 026A)

| Requirement | Evidence |
|---|---|
| Instant RSVP + FIFO waitlist (**AUTO** default) | `activity-rsvp.service.ts` — `resolveJoinPath`; D-09 preserves AUTO behavior |
| Host approval queue (**HOST_APPROVAL** mode) | D-09; PENDING/DECLINED states; join-requests APIs (027E) |
| Meeting privacy | `GET …/meeting` + policy; CONFIRMED + KYC eligible |
| Task 022 gate | Main-app surfaces require full activation |
| Discovery host eligibility | `activity-host-eligibility.ts`, 025C list prefilter |
| Membership billing | D-08 deferred; BASIC activity access unchanged (026A) |

---

## Safe read-only candidates (post-027A, not implemented here)

| Candidate | Phase | Gate |
|---|---|---|
| Self-only **My Activities** aggregation (Upcoming / Hosting / Joined / Waitlisted) | 027B | 027A confirms contract gap; **exclude** approval Pending tab |
| Privacy/count integrity fixes on detail lists | 027C | Concrete defect only |
| Create/manage validation hardening | 027D | Source-confirmed bugs only |
| Host approval workflow | 027E | **Explicit ACT-APPROVAL owner approval** |
| Attendee roster | 027F | **ACT-ROSTER / MDWQ-0704** |
| Chat / followers / cutoff / catalog / notifications | 027G–H | Per-item owner gates |

---

## Owner decision register (Task 027)

| ID | Question | Queue |
|---|---|---|
| ACT-APPROVAL | Instant RSVP vs host approve/decline vs hybrid | MDWQ-0701 |
| ACT-CAPACITY | Meaning of “Approved (8)” vs “6 of 10 spots filled” on Join Requests | MDWQ-0712 |
| ACT-ROSTER | Who sees participant names/avatars (“See All”) | MDWQ-0704 |
| ACT-FOLLOW | Followers-only publish & discovery | MDWQ-0702 |
| ACT-CUTOFF | 2-hour edit/cancel rule | MDWQ-0703 |
| ACT-CATALOG | Yoga / Social & Dining vs current five-slug catalog | MDWQ-0713 |
| ACT-CHAT | Activity “Message Group” vs community group vs defer | MDWQ-0711 |
| ACT-NOTIFY | Lifecycle notifications (cancel, approval, etc.) | MDWQ-0706 |
| D-04 / COPY-TRUST | Geo, maps, ratings, Superhost, verified % | MDWQ-0401, MDWQ-0407 |
| D-08 | Paid caps, Club activity limits | MDWQ-1001, MDWQ-0707 |
