# D-08 — Owner deferral: all payment and subscription billing (2026-10-28)

**Status:** **OWNER DEFERRED** (Task 026A) — not withdrawn; commercial sub-decisions remain **OPEN**.

## Decision

The product owner directed engineering to **defer ALL payment and subscription billing implementation until further notice**, including:

- Apple IAP, Google Play Billing, Stripe, RevenueCat
- Subscription purchase, trial, renewal, cancellation, and restore flows
- Payment webhooks and receipt verification
- Paid Club entitlement activation and subscription ledger migrations
- Marketplace payments and Club merchandise discounts (MKT-03 remains deferred separately)

## Engineering constraints (026A)

- **Effective tier:** every account resolves to **`BASIC`** server-side; **`CLUB` is not purchasable** (`pricing: null`, `canUpgrade: false`).
- **Read-only APIs:** `GET /v1/membership/plans`, `GET /v1/me/membership` return truthful catalog + **`flow`** capability contract (`membership-flow-contract.ts`).
- **Benefit honesty:** capability rows use **`AVAILABLE`**, **`NOT_CONFIGURED`**, **`DEFERRED`**, **`NOT_IMPLEMENTED`** — no invented limits, prices, or trials.
- **Separation preserved:** ADR-003 digital membership vs physical commerce; Task 022 KYC/admin gate independent of billing; `CommunityMembership` ≠ paid subscription.

## Still OPEN (no silent approval)

| ID | Topic |
|---|---|
| D-08-01 | Storefront / payment rails when billing resumes |
| D-08-03 | SKUs, prices, currency, trial terms |
| D-08-04 | Enforceable benefit matrix |
| D-08-05 | Lifecycle, grace, refunds, restore policy |
| D-08-06 | Legal disclosures and consent document IDs |

**Evidence:** Task 026 staged plan; Figma Screen 18 + checkout Html Body (pricing contradictions documented in `flow.figmaEvidence`).

**Next bounded phase:** 026B only after owner explicitly approves ledger requirements — **not started**.
