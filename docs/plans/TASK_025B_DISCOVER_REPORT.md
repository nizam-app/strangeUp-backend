# Task 025B — Discover / Screen 09 engineering report

**Date:** 2026-10-28  
**Phase:** 025B **COMPLETE** (STOP — 025C not started)

## 1. Privacy / security fix

**Issue:** Email-verified users without KYC/admin activation could appear as discovery/public-profile targets while viewers required full activation (Task 022 mismatch).

**Fix:**

- `isDiscoverablePublicProfileTarget()` — same bar as `hasHomeAccess` (ADR-005).
- `canViewPublicProfile()` uses discoverable target check (detail + avatar inherit).
- `buildDiscoverableUsersWhere()` adds Prisma pre-filter + service pass verifies session match / KYC context.
- `DiscoveryService` receives `AppEnv` for production KYC fail-closed consistency.

**Regression tests:** `tests/discover-target-policy.test.ts`; `T025B-P01`, `T025B-P02` in `discovery.integration.test.ts`.

## 2. Screen 09 filters implemented vs deferred

| Filter | Result |
|---|---|
| Search `q` | Unchanged |
| `city` / `region` | Unchanged (D-04 city/region MVP) |
| `interest` (activity chip) | Unchanged — catalog slug |
| Within 5 mi / map / nearest / distance / last-active | **Not implemented** (D-04) |
| Today / age 22–35 | **NEEDS DECISION** |
| Verified chip | Implicit — all listed targets are activation-verified |

## 3. Files touched

- `src/modules/policy/public-profile-policy.ts`
- `src/modules/discovery/discover-target-policy.ts` (new)
- `src/modules/discovery/discover-query.ts`
- `src/modules/discovery/discovery.service.ts`
- `src/modules/discovery/discovery.controller.ts`, `discovery.routes.ts`, `src/app.ts`
- `src/modules/home/home.service.ts` (DiscoveryService env)
- Tests + docs listed in STATUS.md

## 4. Test results (2026-10-28)

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npm run test` | **234/234** pass |
| Focused integration (`discovery`, `main-flow-025a`, `access-enforcement`) | **15/15** pass on isolated Neon **`strangeup_test`** (`RUN_INTEGRATION=1`, guard verified) |

```bash
RUN_INTEGRATION=1 npm run test:integration -- \
  tests/integration/discovery.integration.test.ts \
  tests/integration/main-flow-025a.integration.test.ts \
  tests/integration/access-enforcement.integration.test.ts
```
