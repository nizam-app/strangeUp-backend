# Figma parity — Membership Flow (Task 026A)

**Sources:** `Screen 18_ Membership Plans.pdf`, `Html → Body.pdf` (subscription checkout), `Mask group.pdf` (flow title).  
**Local folder:** `design-reference/task026-membership/` — **PDFs not yet copied**; Phase 0 manifest still lists Screen 18. Task 017 parity doc remains baseline.

**Owner (2026-10-28):** Defer **all** payment/subscription billing. Backend ships **read-only** contracts only.

| Figma element | Backend (026A) | Status |
|---|---|---|
| Basic Explorer / free tier | `GET /v1/me/membership` → `BASIC`, `FREE` | **MATCHED** |
| Strangeup Club card | `CLUB`, `availability: NOT_CONFIGURED`, `purchasable: false`, `pricing: null` | **MATCHED (non-purchasable)** |
| Monthly / Yearly selector | `flow.billingIntervalSelector` — Club intervals **NOT_CONFIGURED**; Basic monthly **AVAILABLE** at $0 | **PARTIAL** — UI toggle **FLUTTER-ONLY** until D-08 |
| `$6.49/mo` / `$77.88/yr` Club | Not in API; listed under `flow.figmaEvidence.knownPricingContradictions` | **DEFERRED (D-08-03)** |
| Checkout `$9.99/mo`, tax, trial math | Not configured; checkout `flow.checkout.status: DEFERRED` | **DEFERRED** |
| Upgrade / Start subscription CTA | `canUpgrade: false`, `upgradeBlockedReasons[]` | **DISABLED** |
| Restore Purchases | Feature `restore_purchases` → **DEFERRED** | **DEFERRED** |
| Apple Pay / payment method | Features `subscription_checkout`, `apple_pay_checkout` → **DEFERRED** | **DEFERRED** |
| Basic perks (3 joins / 5 mi / badge) | `NOT_CONFIGURED` / `NOT_IMPLEMENTED`; `enforced: false` | **Honest metadata — not sold as live** |
| Club perks (radius, concierge, …) | `NOT_IMPLEMENTED`; no enforcement | **NOT IMPLEMENTED** |
| Post-purchase / manage subscription | No Figma exports | **NOT PROVIDED** |
| Settings membership row | Settings overview `membership` + routes | **MATCHED** (Task 017/026A) |
| KYC / admin activation | Independent of plan; Task 022 gate | **MATCHED** |
| Group “membership” | `CommunityMembership` — separate domain | **INDEPENDENT** |
| Marketplace checkout / Club discount | Store checkout **UNAVAILABLE**; pricing **NOT_CONFIGURED** | **DEFERRED (MKT-03 / 024C)** |

## Capability status legend (API)

| Status | Flutter treatment |
|---|---|
| `AVAILABLE` | May render as included; still respect Task 022 per-feature gates |
| `NOT_CONFIGURED` | Do not imply enforcement or pricing; owner policy pending |
| `DEFERRED` | Hide payment/checkout/restore UX; show “coming soon” if needed |
| `NOT_IMPLEMENTED` | Do not market as working Club perk |

**Contract field:** `data.flow` on both plan catalog and self membership (`contractVersion: 2026-10-28-026A`).

**Regression:** No subscription write routes; no DB migrations; no billing webhooks.
