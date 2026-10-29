# Figma parity — Screen 18 Membership Plans (Task 017)

**Superseded for flow/checkout by:** `FIGMA_MEMBERSHIP_PARITY_TASK026A.md` (Task 026A).

**Source:** `Screen 18_ Membership Plans.pdf` (Phase 0 manifest). Figma copy is **illustrative**; not approved commerce terms.

| Figma element | Backend (Task 017) | Status |
|---|---|---|
| Basic Explorer selected / free tier | `GET /v1/me/membership` → `planId: BASIC`, `tierKind: FREE` | **LIVE** |
| Strangeup Club premium card | Catalog entry `CLUB`, `availability: NOT_CONFIGURED`, `purchasable: false` | **NOT_CONFIGURED** |
| Monthly / Yearly toggle | `billingIntervalOptions` on BASIC only (`MONTHLY`); Club pricing `null` | **Partial** (no live annual quote) |
| `$0/mo` Basic | `pricing.monthlyAmountCents: 0` (USD) | **LIVE** |
| `$6.49/mo` annual / `$77.88/yr` Club | Not returned (`pricing: null`) | **DEFERRED (D-08)** |
| 7-day trial marketing | `trial: null`; no trial APIs | **NOT LIVE** |
| Upgrade to Premium CTA | `canUpgrade: false`, `upgradeBlockedReasons[]` | **DISABLED** |
| Apple Pay line | Feature key `apple_pay_checkout` → `UNAVAILABLE` | **NOT LIVE** |
| Basic perks (3 joins / 5 mi / badge) | Feature rows `POLICY_PENDING` / `NOT_IMPLEMENTED`; **`enforced: false`** | **Honest metadata only** |
| Club perks (unlimited radius, concierge, etc.) | `NOT_IMPLEMENTED`; no enforcement | **NOT LIVE** |
| Account-managed subscription copy | `billingStatus: NOT_CONFIGURED`; no subscription object | **NOT LIVE** |
| Settings hub membership row | `GET /v1/me/settings/overview` → `membership` + `capabilities.membershipPlanCatalog: LIVE` | **LIVE** |

**KYC:** ID verification badge is **not** granted by membership. Task 010 KYC gates unchanged.

**Regression:** Task 014 checkout `UNAVAILABLE`; Task 016 interactive media default off; no new paywalls on Tasks 006–016.
