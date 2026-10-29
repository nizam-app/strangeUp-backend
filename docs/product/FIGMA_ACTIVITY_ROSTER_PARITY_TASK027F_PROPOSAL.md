# Figma parity proposal — Activity attendee roster (Task 027F, ACT-ROSTER)

**Status:** **IMPLEMENTED** (2026-10-29) — conservative policy per owner Task 027F scope.  
**Evidence:** `Screen 12_ Activity Details.pdf` in `design-reference/task027-activities-post-membership/`.  
**Technical audit:** `docs/plans/TASK_027F_ATTENDEE_ROSTER_PREIMPLEMENTATION_AUDIT.md`.

## Screen 12 elements vs server

| Figma element | Proposed backend | Status |
|---|---|---|
| Stacked attendee avatars | Optional `participantsPreview[]` on detail **or** separate roster GET | **BLOCKED** on ACT-ROSTER |
| See All (12) | Paginated roster endpoint | **BLOCKED** |
| 12/16 joined text | Existing `confirmedCount`, `capacity` | **MATCHED** |
| Join Activity | D-09 RSVP paths | **MATCHED** (027E) |
| Verified attendee banner | — | **DO NOT SHIP** |

## Privacy parity rules (must hold in any implementation)

1. Roster lists **CONFIRMED** occupants only unless owner explicitly approves waitlist/pending visibility.
2. Apply **bidirectional blocks** and D-03 profile visibility per row.
3. No KYC document fields, no “verified %”, no ratings/review counts.
4. Meeting instructions stay on `GET …/meeting` for CONFIRMED (+ KYC) only.
5. Host join-requests API remains **moderation**, not a public “See All attendees” substitute.

## Open product choice

See audit § “Recommended owner decision” — pick audience (host / confirmed / public) before phase 027F implementation.
