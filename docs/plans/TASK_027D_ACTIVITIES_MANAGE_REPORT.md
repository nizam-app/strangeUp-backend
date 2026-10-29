# Task 027D — Create/manage activity audit & saved-activities privacy

**Date:** 2026-10-29  
**Phase:** 027D (audit + MDWQ-0715 fix + regression tests; no new product policies)  
**Plan:** `cursor_tasks/StrangeUp_TASK_027_After_Membership_Activities_Source_Audited_Staged_Execution.md`

## Create/manage audit (Task 010 baseline)

| Area | Finding |
|---|---|
| Draft CRUD, publish, cancel, host ownership | **Verified** — existing tests T010-N01, T010-N03, T010-P02 |
| Title/description/category/capacity/timezone/end-after-start | **Verified** — Zod + `assertPublishReady` |
| Venue vs meeting instructions | **Verified** — public DTO vs host/meeting endpoints |
| Schedule/mode lock with participants | **Verified** — `canChangePublishedSchedule` → **409** (T027D-M01) |
| Capacity ≥ confirmed count | **Verified** — `canDecreaseCapacity` → **409** (T027D-M02); equal capacity allowed |
| Cover upload/delete/read | **Verified** — host-only, `processAvatarUpload`, scoped storage keys |
| FOLLOWERS_ONLY / 2h cutoff / extra categories / verified toggle | **Decision-gated** — unchanged |
| Pending activation / KYC for host manage | **Verified** — `assertManage` / publish KYC (T010-P02) |
| FIFO / RSVP concurrency | **Verified** — T010-C01 (unchanged) |

**No additional host-service code changes required** beyond saved-activities follow-up.

## MDWQ-0715 — Saved activities host eligibility (fix)

**Defect:** List/save paths did not apply Task 025C host discoverability (027C audit).

**Fix:**

- `saved-activity-visibility.ts` — shared filter using `activity-public-visibility`
- `SavedActivityService` — KYC context; list omits concealed rows; save returns **404** when not visible
- **SavedActivity** DB rows **not deleted** when host later becomes ineligible

**Remaining nuance:** `GET /v1/me/settings/overview` `counts.savedActivities` still counts raw DB saves (may exceed visible list length). Document for Flutter; optional future “visible save count” not in 027D scope.

## Files changed

| File | Change |
|---|---|
| `src/modules/saved-activities/saved-activity-visibility.ts` | **New** |
| `src/modules/saved-activities/saved-activity.service.ts` | Host eligibility on list/save |
| `src/modules/saved-activities/saved-activity.controller.ts` | Pass KYC env |
| `src/modules/settings/settings-overview.service.ts` | KYC for SavedActivityService |
| `tests/saved-activity-visibility.test.ts` | Unit |
| `tests/integration/activity-manage-027d.integration.test.ts` | Manage regression |
| `tests/integration/saved-activities-privacy-027d.integration.test.ts` | MDWQ-0715 Neon |

## Tests

| Command | Result |
|---|---|
| `npm run typecheck` / `lint` / `build` | Pass |
| `npm test` | **251** passed |
| `activity-manage-027d` + `saved-activities-privacy-027d` + `activity-privacy-027c` (Neon) | **6/6** |

Full Neon regression **not** run.

## Master queue

| ID | Status |
|---|---|
| MDWQ-0715 | **COMPLETED** (027D) |
| MDWQ-0702, 0703, 0713, 0701, … | Unchanged / open |

## STOP

Phase **027D** complete. **027E not started.**
