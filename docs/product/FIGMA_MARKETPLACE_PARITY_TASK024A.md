# Figma parity — Task 024A (Catalog & cart integrity)

**Phase:** 024A only (no checkout, orders, Club pricing, reviews, shipping).  
**Evidence:** Owner Screen 21 (Product Details) and Screen 22 (Cart & Checkout) PDFs (Marketplace ZIP); pre-implementation read-only audit (2026-10-28). Copy PDFs to `design-reference/marketplace/` when available in repo — phase logic verified against live store modules.

## Screen 21 — Product Details

| Control / action | API | Payload / auth | Edge states | Flutter action |
|---|---|---|---|---|
| Gallery / image swipe | `GET /v1/store/products/:productId/images/:imageId` | Bearer + Task 022 home access | 404 unpublished/missing file | Load bytes when `images[]` present |
| Color / size selection | `GET /v1/store/products/:productId` → `variants[]` | Same | Only **active** variants returned | Bind UI to `variantId` |
| Quantity stepper (pre-cart) | Client-side until cart PUT | — | Cap at `min(stockQuantity, 99)` | `PUT .../cart/items/:variantId` |
| Stock / low-stock hint | `variants[].stockQuantity`, `inStock` | Same | `inStock=false` when inactive or zero stock | Show sold-out; disable add |
| List / compare-at price | `priceCents`, `compareAtPriceCents` | Server authoritative | — | Format cents + `currency` |
| Club member price / savings | — | **Not in API** | D-08 open | Hide or static “coming soon” |
| Favorite | `PUT/DELETE /v1/me/store/favorites/:productId` | Self only | Unpublished → 404 on write | Heart toggle |
| Ratings / reviews | — | **Not implemented** | MKT-04 | Do not fabricate counts |
| Official / Verified badge | — | **Not implemented** | MKT-02 | Hide |
| Pickup vs shipping | — | **Not implemented** | MKT-03 | Hide selectors |
| Add to cart | `PUT /v1/me/store/cart/items/:variantId` | Validates published + active + stock | 400 over stock / line limits; 404 bad variant | Refresh cart |
| Buy now / Place order | — | `checkout.status=UNAVAILABLE` | No checkout route | Route to cart; disable pay |

## Screen 22 — Cart & Checkout

| Control / action | API | Payload / auth | Edge states | Flutter action |
|---|---|---|---|---|
| List lines, qty, remove | `GET/PUT/DELETE /v1/me/store/cart[...]` | Self scoped | Stale stock → `availability` on read | Show per-line status |
| Base subtotal (honest) | `GET /v1/me/store/cart` | `subtotalCents` = **fulfillable** catalog sum | Excludes unavailable lines; caps insufficient lines at on-hand qty | Label as subtotal, not total due |
| Display line math | Same | `linesSubtotalCents`, `lineSubtotalCents` | Requested qty pricing for UI | Optional strikethrough when `INSUFFICIENT_STOCK` |
| Per-line guidance | Same | `availability`, `availabilityReason`, `maxPurchasableQuantity`, `eligibleLineSubtotalCents` | `PRODUCT_NOT_PUBLISHED`, `VARIANT_INACTIVE`, `INSUFFICIENT_STOCK` | Prompt reduce qty or remove |
| Cart summary flags | Same | `summary.allLinesPurchasable`, `hasInsufficientStock`, `hasUnavailableLines` | Checkout still off | Disable “ready to checkout” UX |
| Club line discounts / extra discount row | — | **Not implemented** | Figma double-discount conflict | Do not show |
| Free shipping progress | — | **Not implemented** | Threshold conflict in Figma | Do not show |
| Delivery / pickup / address | — | **Not implemented** | MKT-03 | Hide |
| Saved card / Apple Pay | — | **Not implemented** | MKT-03 / PCI | Hide |
| Tax | — | **Not implemented** | — | Hide |
| Place order | — | `checkout.status=UNAVAILABLE` | Always | Button disabled |

## 024A semantics change (backward compatible)

| Field | Before 024A | After 024A |
|---|---|---|
| `subtotalCents` | Sum of lines except `UNAVAILABLE` (included **full** qty for `INSUFFICIENT_STOCK`) | Sum of **fulfillable** value (`eligibleLineSubtotalCents` per line) |
| `linesSubtotalCents` | — | **New:** sum of `lineSubtotalCents` at requested quantities |
| Line fields | `availability`, `lineSubtotalCents` | + `eligibleLineSubtotalCents`, `maxPurchasableQuantity`, `availabilityReason` |
| `summary` | — | **New:** counts and boolean flags |

**Flutter:** Use `subtotalCents` for “what catalog allows today”; use `linesSubtotalCents` only if showing pre-adjustment line math. Never treat either as checkout total while `checkout.status=UNAVAILABLE`.

## Unresolved Figma conflicts (owner decisions)

- Club jersey/flask prices plus separate **$15 Club discount** row — arithmetic ambiguous (024C / D-08).
- **$4.99 delivery** vs cart **>$100** still showing delivery fee — no approved shipping rule (024C/024D).
- Activity-linked pickup copy — no order/pickup domain (024D).
- Reviews, verified badges, member savings labels — not system truth (024B+ / MKT-04).

## Classification summary (Screens 21–22)

| Area | Status |
|---|---|
| Catalog browse, detail, variants, favorites, cart CRUD | **MATCHED** (024A integrity) |
| Cart subtotal honesty vs stale stock | **MATCHED** (024A fix) |
| Checkout, tax, shipping, Club discounts, payments | **DEFERRED** |
| Reviews, badges, pickup/shipping selectors | **MISSING / DEFERRED** |
| Place Order | **DISABLED** (`UNAVAILABLE`) |

**024B (complete):** Staff `/v1/admin/store-catalog/*` + S3/local image ingest; buyer Screens 21–22 contracts unchanged; checkout still UNAVAILABLE.

**024C (complete):** Pricing policy + cart `pricingQuote`; list+single-discount model; Figma Club prices/discount rows **not** in API amounts.

**024D (complete):** Fulfillment policy + cart `orderReadiness`; pickup/shipping `NOT_CONFIGURED`; no orders.

**Next gated phase:** 024E — payments & checkout (owner approval; sandbox only).
