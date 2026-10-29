# Task 027C — Activity detail & participation privacy hardening

**Date:** 2026-10-29  
**Phase:** 027C only (targeted fixes + regression tests; no schema migrations)  
**Plan:** `cursor_tasks/StrangeUp_TASK_027_After_Membership_Activities_Source_Audited_Staged_Execution.md`

## Audit summary

| Surface | Host ineligible (025C) | Blocked | Participant KYC lost (post-confirm) |
|---|---|---|---|
| `GET /v1/activities` (discover) | Filtered in service | Host omitted in query | N/A |
| `GET /v1/activities/:id` | **404** | **404** | **403** activities gate when home access lost |
| `GET …/cover` | **404** (via shared visibility) | **404** | **403** when gate lost |
| `GET …/meeting` (non-host) | **404** after fix (was inconsistent) | **404** | **403** (browse or KYC) |
| `POST …/rsvp` (new join) | **404** after fix | **404** | KYC path unchanged |
| `POST …/rsvp` (idempotent CONFIRMED/WAITLISTED) | **200** (unchanged) | N/A | N/A |
| `DELETE …/rsvp` | **200** (unchanged) | N/A | N/A |
| `GET /v1/me/activity-inventory` | Self rows remain; host preview **redacted** | Preview redacted | **403** when viewer loses home access |
| Host `GET …/meeting` after host deactivation | **403** (Task 022 gate) | — | — |

**Preserved:** RSVP rows not deleted on visibility denial; instant RSVP + FIFO unchanged.

## Defects fixed (source-confirmed)

1. **`GET /v1/activities/:id/meeting`** — Non-host confirmed participants could still read meeting instructions after the host lost main-app activation (detail/cover already **404**). **Fix:** apply shared public discoverability guard before meeting authorization (`activity-public-visibility.ts`).
2. **`POST /v1/activities/:id/rsvp`** — New joins were allowed when the host was no longer discoverable (deep link). **Fix:** same guard for non-idempotent join paths only.

## Not changed (by design)

- Attendee roster, host approval, inventory tab semantics (027B).
- Saved activities list (`/v1/me/saved-activities`) still omits host-eligibility filter — **audit note**; out of 027C explicit surface list; track if product wants parity.
- Discover list post-filter pagination (025C) — short pages possible when many ineligible hosts in a DB window; documented behavior, not altered in 027C.

## Code changes

| File | Change |
|---|---|
| `src/modules/activities/activity-public-visibility.ts` | **New** shared 025C/027C discoverability helper |
| `src/modules/activities/activity.service.ts` | Refactor `loadVisiblePublished`; harden `getMeeting` |
| `src/modules/activities/activity-rsvp.service.ts` | Block new RSVP when host not discoverable |
| `tests/activity-public-visibility.test.ts` | Unit |
| `tests/integration/activity-privacy-027c.integration.test.ts` | Neon security regression |

## Tests

| Command | Result |
|---|---|
| `npm run typecheck` / `lint` / `build` | Pass |
| `npm test` | **249** passed |
| `RUN_INTEGRATION=1` … `activity-privacy-027c.integration.test.ts` | **3/3** |
| `RUN_INTEGRATION=1` … `activity-inventory-027b.integration.test.ts` | **2/2** (027B regression) |

Full Neon regression **not** run.

## Master queue

| ID | Update |
|---|---|
| MDWQ-0715 | **Added** — Saved activities host-eligibility parity (audit follow-up, not 027C scope) |
| MDWQ-0710 | Unchanged **COMPLETED** (027B) |

## STOP

Phase **027C** complete. **027D not started.**
