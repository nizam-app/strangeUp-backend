# Main Flow Figma parity — Task 025C (Activities / Screen 11)

**Date:** 2026-10-28  
**Evidence:** `Screen 11_ Activity Discovery.pdf` (`design-reference/task025-main-flow/`). Screens **12–13** not in Main Flow ZIP; parity follows Task 010 matrix + `FIGMA_ACTIVITIES_PARITY_MATRIX_2026-10-27.md`.

## Screen 11 action matrix

| Figma control | API | Status |
|---|---|---|
| Activities list | `GET /v1/activities` | **MATCHED** |
| Category chips (Biking, Swimming, Fitness) | `category={slug}` + `GET /v1/activity-categories` | **PARTIAL** — catalog has biking, padel-tennis, running, swimming, fitness; Figma also shows Sports/Hiking/Social/Other (**NEEDS DECISION** ACT-CATALOG) |
| Search activities, hosts, sports | `q` matches title **or** host displayName/username | **MATCHED** (025C) |
| Miami Beach / Within 5 miles | `city` / `region` only | **PARTIAL** (D-04) — no radius |
| List / Map | — | **FLUTTER-ONLY** / **DEFERRED** (D-04) |
| Spots left / capacity (e.g. 4 spots left) | `confirmedCount`, `capacity`, `spotsLeft` on card | **MATCHED** |
| Join Activity | `POST /v1/activities/{id}/rsvp` | **MATCHED** — instant confirm or waitlist (not host approve queue) |
| Host preview on card | Host preview DTO (D-03 + activation) | **MATCHED** |
| ID verified marketing strip | Policy gates on join/publish | **PARTIAL** — no badge field |
| Miles away on cards | — | **NOT IMPLEMENTED** (D-04) |
| Host star ratings | — | **NOT IMPLEMENTED** (COPY-TRUST) |

## Screens 12–13 (supporting, Task 010)

| Topic | Status |
|---|---|
| Detail, meeting split, RSVP states | **MATCHED** (existing Task 010) |
| Create draft / publish / waitlist toggle | **MATCHED** |
| Host manual approve/decline requests | **NEEDS DECISION** (ACT-APPROVAL) — backend uses automatic RSVP + FIFO waitlist |

## Task 025C backend changes

- Activity discovery lists and detail require **main-app activated hosts** (aligned with 025B discover targets).
- Search `q` includes host name/username.
- Home upcoming group activity cards skip ineligible hosts.

## Open decisions for 025D+

- **ACT-APPROVAL** — host review vs instant RSVP  
- **ACT-CATALOG** — extra Figma category chips  
- **D-04** — map, miles, nearest ordering  
- **ACT-ROSTER** — attendee “See All” faces  
