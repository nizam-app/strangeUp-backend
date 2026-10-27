# Figma → API parity matrix (Task 010 — Screens 11–13)

**Inspection date:** 2026-10-27  
**Source:** Task 010 screen map + original PDF titles `Screen 11_ Activity Discovery.pdf`, `Screen 12_ Activity Details.pdf`, `Screen 13_ Create Activity.pdf`. Local design-reference package currently holds the 13-file profile/discovery set; activity PDFs were not present in that folder at implementation time.  
**Policy precedence:** KYC-01/03/05, KYC-ENF-01..05, D-03/D-04, `D-ACTIVITIES-TASK010.md`.

Legend: **IMPLEMENTED** = coded; **DB PENDING** = integration not run on native PostgreSQL; **DEFER** = not built; **DO NOT SHIP** = mock-only Figma claim.

## Screen 11 — Activity Discovery

| Control | API | Status |
|---|---|---|
| Activity list cards | `GET /v1/activities` public card DTO | **IMPLEMENTED** / **DB PENDING** |
| Search / category / city / region / date | Query `q`, `category`, `city`, `region`, `startsAfter`, `startsBefore`, `mode` | **IMPLEMENTED** (non-geo) |
| Join action | `POST /v1/activities/:activityId/rsvp` | **IMPLEMENTED** |
| Map, miles-away, Nearby / Within 5 miles | — | **DEFER** (D-04) |
| Host verification badge / fake attendance | — | **DO NOT SHIP** |
| Home dashboard reuse | Same list service later | **DEFER** (dashboard not this task) |

## Screen 12 — Activity Details

| Control | API | Status |
|---|---|---|
| Public description, schedule, venue display, capacity, spots | `GET /v1/activities/:activityId` | **IMPLEMENTED** |
| Pace/skill and gear notes | `skillNotes`, `gearNotes` | **IMPLEMENTED** |
| Host preview | D-03 visibility + blocks; hidden fields nulled if profile not viewable | **IMPLEMENTED** |
| Exact meeting instructions | `GET /v1/activities/:activityId/meeting` (host or confirmed eligible only) | **IMPLEMENTED** |
| Attendee face roster / See All | — | **DEFER** (ACT-ROSTER) |
| Star ratings, “100% verified”, host metrics | — | **DO NOT SHIP** |
| Directions / map pin | — | **DEFER** |

## Screen 13 — Create Activity

| Control | API | Status |
|---|---|---|
| Draft create | `POST /v1/me/activities` | **IMPLEMENTED** |
| Edit draft / published safe fields | `PATCH /v1/me/activities/:activityId` | **IMPLEMENTED** |
| Publish | `POST /v1/me/activities/:activityId/publish` | **IMPLEMENTED** (KYC for real-world) |
| Cancel | `POST /v1/me/activities/:activityId/cancel` | **IMPLEMENTED** |
| Name, category, description (500), schedule, venue, capacity, waitlist | Request allowlist | **IMPLEMENTED** |
| Optional cover | `POST/GET/DELETE /v1/me/activities/:id/cover` | **IMPLEMENTED** (local disk) |
| Public (Nearby) | `audience=PUBLIC` — authenticated list, **not** geo | **IMPLEMENTED** |
| Followers Only | Draft storage only; cannot publish | **DEFER** audience |
| Only Allow Verified Members toggle | Ignored as a client authority; server KYC-ENF always applies to real-world confirm | **DO NOT SHIP** as a weakening switch |
| Two-hour edit lock | Not enforced | **Unresolved** (ACT-CUTOFF) |
| Payments / ticketing | — | **DEFER** |
