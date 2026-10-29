# Task 025D — Profile / Settings engineering report

**Date:** 2026-10-28  
**Phase:** 025D **COMPLETE** (STOP — 025E not started)

## Security / identity fix

**Issue:** `PATCH /v1/me/profile` allowed `firstName` / `lastName` changes after trusted provider KYC, weakening binding to verified identity.

**Fix:** `profile-identity-policy.ts` — lock legal names when `hasTrustedKycForEnforcement` is true. Profile responses include `legalNameLocked`. Settings overview `account` adds `adminReviewStatus`, `legalNameLocked`, existing `fullAccess`.

## Preserved

- DOB read-only (schema unchanged)  
- DEV_ONLY email change, session inventory, password change  
- Account deletion impact only (`UNAVAILABLE` delete)  
- Overview counts from DB (no mock meetup/rating numbers)  
- Onboarding-safe profile PATCH before Home gate  

## Files

- `src/modules/me/profile-identity-policy.ts`, `me.service.ts`, `me.controller.ts`
- `src/modules/settings/settings-overview.service.ts`, `settings.controller.ts`
- `tests/profile-identity-policy.test.ts`, `tests/integration/main-flow-025d.integration.test.ts`
- `docs/product/FIGMA_MAIN_FLOW_PARITY_TASK025D.md`, API/handoff/OpenAPI updates

## Tests (2026-10-28)

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npm run test` | **237/237** pass |
| Focused integration (`main-flow-025d`, `me`, `settings`) | **30/30** pass on Neon **`strangeup_test`** |

```bash
RUN_INTEGRATION=1 npm run test:integration -- \
  tests/integration/main-flow-025d.integration.test.ts \
  tests/integration/me.integration.test.ts \
  tests/integration/settings.integration.test.ts
```
