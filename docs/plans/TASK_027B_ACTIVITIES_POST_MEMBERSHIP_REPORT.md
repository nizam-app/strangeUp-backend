# Task 027B — My Activities read-model parity

**Date:** 2026-10-29  
**Phase:** 027B only (read APIs + tests + docs; no schema migrations)  
**Plan:** `cursor_tasks/StrangeUp_TASK_027_After_Membership_Activities_Source_Audited_Staged_Execution.md`

## Audit conclusion (reuse vs new)

| Existing API | Role after 027B |
|---|---|
| `GET /v1/me/activities` | **Reused** — host manage list; added optional `when=upcoming\|past\|all` |
| `GET /v1/me/activity-rsvps` | **Reused** — participant list; added `when` + `participation=confirmed\|waitlisted\|active` |
| `GET /v1/activities/:id`, host detail, RSVP leave, publish/cancel | **Unchanged** |

**New (justified gap):** `GET /v1/me/activity-inventory` — single truthful contract for Figma tabs, deduped **Upcoming** (future hosting + future **CONFIRMED** joins), optional tab **counts**, **public cards only** (no meeting instructions).

## Implemented behavior

| `view` | Contents |
|---|---|
| `upcoming` | Eligible future hosted activities + future **CONFIRMED** participations; sorted by `startsAt` asc; deduped by `activityId` |
| `hosting` | Self-hosted, non-terminal status, `startsAt > now` |
| `joined` | **CONFIRMED** on published, non-cancelled activities, upcoming |
| `waitlisted` | **WAITLISTED** on same activity eligibility, upcoming |
| `past` | Hosted + participant (confirmed/waitlisted) with `startsAt <= now`, sorted desc |

**Explicitly absent:** Pending / Approved / Declined host-approval states (ACT-APPROVAL).

**Security preserved:** Task 022 full access gate; block-aware host previews; no roster; no meeting fields on inventory rows; host DTOs on `/v1/me/activities` unchanged.

## Source / Figma parity (`Html → Body.pdf`)

| Figma | Backend |
|---|---|
| Upcoming / Hosting / Joined tabs | `view=upcoming\|hosting\|joined` + counts |
| Waitlist UX (FIFO, not approval) | `view=waitlisted`; state **WAITLISTED** |
| Pending / Cancel request | **Not implemented** — MDWQ-0714 / ACT-APPROVAL |
| Message Group | **Not implemented** — MDWQ-0711 |
| Past section | `view=past` |
| Tab badge counts | `includeCounts=true` → `counts.{upcoming,hosting,joined,waitlisted}` |

PDF hashes updated in `design-reference/task027-activities-post-membership/MANIFEST.md` (on-disk authoritative).

## Files changed

**Application:** `activity-my-inventory.{policy,service}.ts`, `activity.{dto,validation}.ts`, `activity-host.service.ts`, `activity-rsvp.service.ts`, `activities.{controller,routes}.ts`, `settings-overview.service.ts`

**Tests:** `tests/activity-my-inventory.policy.test.ts`, `tests/integration/activity-inventory-027b.integration.test.ts`

**Docs:** `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md`, `openapi/activities.yaml` (0.2.0), `FIGMA_ACTIVITIES_POST_MEMBERSHIP_PARITY_TASK027A.md`, `MASTER_DEFERRED_WORK_QUEUE.md`, `MANIFEST.md`, this report

## Test evidence

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npm test` | **247** passed (unit; includes policy tests) |
| `RUN_INTEGRATION=1 npm run test:integration -- tests/integration/activity-inventory-027b.integration.test.ts` | **2/2** passed on `strangeup_test` |

Full Neon regression **not** run (per release gate).

## Master queue

| ID | Status |
|---|---|
| MDWQ-0710 | **COMPLETED** (this phase) |
| MDWQ-0714 | **Added** — Figma Pending tab blocked on ACT-APPROVAL |
| MDWQ-0701, 0711–0713 | Open unchanged |

## STOP

Phase **027B** complete. **027C not started.**
