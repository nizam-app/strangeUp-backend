# Task 025C — Activities / Screen 11 engineering report

**Date:** 2026-10-28  
**Phase:** 025C **COMPLETE** (STOP — 025D not started)

## Confirmed defects fixed

1. **Host activation (Task 022 / 025B alignment):** Published activities could remain discoverable when the host was email-verified only or lost admin activation. Fixed via `buildActivatedDiscoverTargetWhere` on list queries, `isDiscoverableActivityHost` on list/detail/home upcoming cards.
2. **Search parity:** `q` searched title only; Figma includes hosts — extended to host `displayName` / `username`.

## Preserved (Task 010)

- Cursor pagination (`startsAt`, `id`), category/city/region/mode/date filters  
- RSVP instant confirm, waitlist FIFO, concurrency tests T010-C01  
- Meeting instructions gated; blocks → 404  
- KYC on real-world confirm/publish  

## Files changed

| File | Change |
|---|---|
| `activity-host-eligibility.ts` | New helper |
| `activity-query.ts` | Activated host filter; search OR |
| `activity.service.ts` | Post-filter + detail gate |
| `activity-mapper.ts` | Host activation fields on select |
| `home.service.ts` | Upcoming group activity host gate |
| Tests | `activity-host-eligibility.test.ts`, `activity-query.test.ts`, `T025C-P01/P02` |
| Docs | `FIGMA_MAIN_FLOW_PARITY_TASK025C.md`, handoff/API updates |

## Test results (2026-10-28)

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npm run test` | **235/235** pass |
| Focused integration (`activities`, `main-flow-025a`, `access-enforcement`) | **17/17** pass on Neon **`strangeup_test`** |

Existing Task 010 coverage retained: T010-C01 waitlist FIFO, T010-N02 blocks/meeting privacy, T010-P02 activation gates.

## Unresolved for 025D

- Profile/settings Screen 26 + Edit Personal Details  
- ACT-APPROVAL, ACT-CATALOG extras, D-04 geo  
