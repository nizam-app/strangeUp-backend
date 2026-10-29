# Store merchandise pricing & Club benefits — contract (Task 024C)

**Phase:** 024C foundation only — **no** live discount math, checkout totals, tax, shipping, or subscription billing.

## Canonical model (owner-facing)

| Choice | Decision |
|---|---|
| **Selected model** | **`LIST_PRICE_PLUS_SINGLE_CART_DISCOUNT`** |
| List/base authority | Server catalog `StoreProductVariant.priceCents` (integer cents + ISO currency) |
| Compare-at | Optional `compareAtPriceCents` (display only; not a second discount) |
| Membership adjustment | **At most one** aggregated membership discount on the cart quote when D-08 enables it |
| **Rejected pattern** | Figma-style **reduced line unit prices** *plus* a separate “Club discount” row (double discount) |

**Anti-double-discount rule:** Per-line member unit prices and a cart-level membership discount are **mutually exclusive**. Future implementation must use list unit prices + single quote discount **or** explicit member unit prices with **no** separate discount line — not both.

## API surfaces (buyer)

| Screen | Route | New / extended fields |
|---|---|---|
| 20 grid | `GET /v1/store/products` | `pricingHint.membershipPriceStatus=NOT_CONFIGURED` |
| 21 detail | `GET /v1/store/products/:id` | `variants[].pricing`, `merchandisePricingPolicy` |
| 22 cart | `GET /v1/me/store/cart` | `pricingQuote` (parallel to 024A `subtotalCents`) |
| Policy | `GET /v1/store/pricing-policy` | Machine-readable contract + owner decision list |

**Unchanged:** `subtotalCents` / 024A fulfillable semantics; `checkout.status=UNAVAILABLE`; staff catalog 024B.

## `pricingQuote` semantics (cart)

- `catalogSubtotalCents` — equals fulfillable `subtotalCents` (list catalog value).
- `membershipDiscount` — always **`NOT_CONFIGURED`** until D-08 + MKT-03; `discountCents` and `percentBasisPoints` are **`null`**.
- `shipping` / `tax` — **`NOT_CONFIGURED`**, amounts **`null`**.
- `totalDueCents` — always **`null`** (no payable total).
- `viewer.effectivePlanId` — from trusted entitlements (`BASIC` today).
- `viewer.clubMerchandiseBenefitEligible` — **`false`** until billing-backed CLUB exists.

## Figma Screen 21–22 contradictions (do not implement)

1. **Double Club discount:** Jersey/flask show member-ish line prices **and** a separate **$15 Club discount** — arithmetic does not define an approved business rule.
2. **Free shipping:** Screen 21 “free over $50” vs Screen 22 delivery fee on **>$100** cart — no approved threshold or eligible subtotal.
3. **Club savings labels** on product detail — no trusted percentage or member unit price in API.
4. **Place Order / totals** — remain disabled (`checkout UNAVAILABLE`).

## Owner decisions before real calculations (024D/E)

| ID | Topic | Blocks |
|---|---|---|
| D-08 | Club billing, purchasable plan, trusted CLUB entitlement | Any non-null `discountCents` |
| MKT-03 | Discount % / basis points, eligible SKUs, rounding | Membership discount engine |
| MKT-03 | Shipping, tax, free-shipping threshold | `shipping` / `tax` / `totalDueCents` |
| ADR-003 | Physical commerce vs digital membership billing | Payment integration |
| Figma conflict | Confirm list+single discount vs member line prices only | UI presentation |

## Flutter guidance

- Render **`priceCents`** / `pricing.listUnitPriceCents` as the **only** authoritative unit price.
- Do **not** show Figma Club prices, savings badges, or second discount rows until `membershipDiscount.status === "APPLIED"` (future).
- Hide shipping/tax/total due while components remain `NOT_CONFIGURED`.
- See `FLUTTER_DEVELOPER_HANDOFF.md` §17.2.

## Test vectors (unit)

See `tests/store-pricing.test.ts` — BASIC user, zero discount cents, null total due, policy text present.

**Next phase (024D):** Fulfillment/order architecture — still no payments.
