# Task 026A — Membership flow contract (complete)

**Date:** 2026-10-28  
**Scope:** Backend read-only membership parity; **no** 026B ledger, **no** payments.

## Owner decisions recorded

- **Defer all payment and subscription billing** until further notice → `docs/decisions/D-08-owner-defer-billing-2026-10-28.md`
- D-08-01..06 remain **OPEN**; no Figma prices/trials approved.

## Implementation

| Area | Change |
|---|---|
| Plan registry | Benefit statuses aligned to `AVAILABLE` / `NOT_CONFIGURED` / `DEFERRED` / `NOT_IMPLEMENTED`; Club checkout/restore rows **DEFERRED** |
| Flow contract | `src/modules/membership/membership-flow-contract.ts` — versioned `flow` on plans + self membership |
| Entitlements | `buildSelfMembership` includes `flow` + community-group separation note |
| Upgrade blockers | Added `OWNER_DEFERRED_ALL_PAYMENT_AND_SUBSCRIPTION_BILLING` |

**Preserved:** Task 017 routes, Task 022 gates, BASIC-only `resolveEffectivePlanId`, store checkout UNAVAILABLE, no Prisma subscription models.

## Tests (2026-10-28 local)

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** |
| `npm run test -- tests/membership-*.test.ts` (3 files) | **8/8 PASS** |
| `RUN_INTEGRATION=1 npm run test:integration -- tests/integration/membership.integration.test.ts` | **5/5 PASS** (Neon `strangeup_test`) |

Full Neon regression **not run** (release gate only).

## Remaining non-payment gaps

| Gap | Blocker |
|---|---|
| Copy membership flow PDFs into `design-reference/task026-membership/` | Owner/asset upload |
| Monthly/yearly Club SKU presentation | D-08-03 |
| Enforce BASIC join cap / radius | D-08-04 + geo/product foundations |
| Club perk enforcement | D-08-04 + feature modules |
| Settings `capabilities.subscription` | Remains **DEFERRED** until billing approved |
| Billing push notifications | No provider events (Task 023) |
| Post-purchase / manage subscription APIs | No Figma + D-08-05 |

## STOP

026B (subscription ledger schema) **not started** per owner deferral and staged plan gate.
