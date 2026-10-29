# Physical fulfillment & order architecture — foundations (Task 024D)

**Phase:** 024D only — **no** order persistence, placement routes, inventory reservation, shipping charges, tax, or payments.

## Schema audit (pre-change)

| Area | Models | Order domain |
|---|---|---|
| Store | `StoreProduct`, `StoreProductVariant`, `StoreCartItem`, images | Cart only; **no** `Order` table |
| Activities | `Activity`, `ActivityParticipation`, `SavedActivity` | RSVP separate from merch fulfillment |
| Membership | Task 017 entitlements (`BASIC` default) | **No** link to physical orders |

**024D did not add Prisma models** — transactional tables wait for MKT-03 + 024E owner approval (reversible TypeScript contract only).

## Domain boundary (ADR-003)

- **`PHYSICAL_MERCHANDISE_ORDER`** — future orders, fulfillment snapshots, payment intents for goods.
- **Club / IAP billing** — remains in membership domain; order APIs must not grant or renew Club.

## Fulfillment methods (capability contract)

| Method | Status (now) | Meaning |
|---|---|---|
| `SHIPPING` | `NOT_CONFIGURED` | Address snapshot schema defined in code; no rates or carriers |
| `ACTIVITY_PICKUP` | `NOT_CONFIGURED` | Eligibility **spec** documented; no enforcement until orders exist |

Honest states: **`NOT_CONFIGURED`** (policy pending), **`UNAVAILABLE`** (reserved for future denial), **`AVAILABLE`** (future live selection).

## Cart extensions (024A–024C preserved)

`GET /v1/me/store/cart` adds:

- **`fulfillment`** — method capabilities; `selectedMethod: null`
- **`orderReadiness`** — `cartLinesOrderEligible`; blocked lines with reasons
- **`pricingQuote` / `checkout`** — unchanged semantics; checkout **`UNAVAILABLE`**

### Stock / order rule (hard)

- **`INSUFFICIENT_STOCK` lines block `orderReadiness`** — server **never** auto-reduces requested quantity into a future order snapshot.
- Fulfillable **`subtotalCents`** (024A) may still reflect on-hand cap for display; **orders require `availability === AVAILABLE` at full requested qty**.

## Future order design (not implemented)

| Concern | Foundation in repo |
|---|---|
| Idempotency | `physicalOrderIdempotencyKeySchema` (8–128 chars) |
| Shipping address | `physicalOrderShippingAddressSnapshotSchema` |
| Fulfillment selection | `physicalOrderFulfillmentSelectionSchema` discriminated union |
| Line snapshot | `physicalOrderLineSnapshotSchema` (server must re-validate price/stock) |
| Lifecycle | `PHYSICAL_ORDER_LIFECYCLE_SPEC` constant (documentation only) |

## Activity-linked pickup (eligibility spec)

When implemented (post-decision):

1. Activity **`PUBLISHED`**
2. User participation **`CONFIRMED`** (does not mutate RSVP)
3. Handoff proof / leader display — **owner decision**
4. Pickup window relative to activity start — **owner decision**

See `GET /v1/store/fulfillment-policy` → `activityPickupEligibility`.

## Owner decisions before transactional orders (024E)

1. **MKT-03** — Shipping vs pickup, address retention, carriers, rates  
2. **MKT-03** — Activity pickup handoff, staff tools, proof  
3. **MKT-03** — Stock reservation TTL, cancel/restock, oversell protection  
4. **MKT-03** — Tax jurisdiction and calculation  
5. **ADR-003** — Final sign-off on separate commerce schema  
6. **024E** — Payment provider, chargeable checkout, webhooks  

## API

| Method | Path |
|---|---|
| `GET` | `/v1/store/fulfillment-policy` |

Flutter: `FLUTTER_DEVELOPER_HANDOFF.md` §17.3.

**Next phase (024E):** Payments & checkout — still owner-gated; sandbox only when approved.
