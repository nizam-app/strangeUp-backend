# Main Flow Figma parity — Task 025E (final matrix)

**Date:** 2026-10-28  
**Evidence:** All nine PDFs in `design-reference/task025-main-flow/` (see `MANIFEST.md`).  
**Phases 025A–025D:** See phase docs; this document is the **single consolidated** Main Flow parity register.

**Legend:** MATCHED | PARTIAL | MISSING | DEFERRED | FLUTTER-ONLY | NEEDS DECISION

**Main-app gate (Task 022):** Home, Discover, Activities, Marketplace catalog/cart, Profile settings hub (post-gate sections) require **trusted provider KYC + StrangeUp admin approval** on the current session. Pending → `403 ONBOARDING_REQUIRED`; rejected/revoked → `403 ACCOUNT_NOT_ACTIVATED` or KYC denial as applicable.

**Cross-tab navigation (Flutter):** No unified backend “tab router.” Each tab maps to documented REST mounts; `GET /v1/me/onboarding/status` and error payloads (`homeAccessAllowed`, `nextAction`) drive gating UX.

---

## Tab 1 — Home (Screen 08 ×2)

| Figma action / surface | API | Status |
|---|---|---|
| Five-tab shell | Per-module `requireHomeAccess` | **MATCHED** |
| Location header (city/region) | `GET /v1/me/profile` | **MATCHED** |
| People Near You + See All | `GET /v1/home` → `people`; `/v1/discover/people` | **MATCHED** (no miles) |
| Activities Near You | `GET /v1/home` → `activities`; `/v1/activities` | **PARTIAL** (no map/geo) |
| Join Activity | `POST /v1/activities/{id}/rsvp` | **MATCHED** |
| Community / groups preview | `GET /v1/home` → `featured`, `myGroups`, `communityFeedPreview` | **PARTIAL** |
| Stories row (update variant) | `stories.status: DEFERRED` | **DEFERRED** (D-06) |
| Active peer / marketing counts | — | **FLUTTER-ONLY** (COPY-TRUST) |
| Global search | — | **DEFERRED** |
| Notifications bell | `notificationsUnreadCount` + `/v1/me/notifications` | **MATCHED** |
| Messages badge | `GET /v1/me/messaging/summary` | **MATCHED** (Task 023) |

**NEEDS DECISION:** HOME-08 authoritative Screen 08 variant.

---

## Tab 2 — Discover (Screen 09)

| Figma action | API | Status |
|---|---|---|
| People list | `GET /v1/discover/people` | **MATCHED** |
| Search `q`, city, region, interest | Query params (strict schema) | **MATCHED** |
| Pagination | `cursor`, `limit` | **MATCHED** |
| Discoverable targets only | Activated hosts/users (025B) | **MATCHED** |
| Map / 5 mi / nearest / last-active | — | **DEFERRED** (D-04) |
| Age / Today / verified chips | — | **NEEDS DECISION** / implicit post-025B |
| Wave / profile | Social + public profile routes | **MATCHED** |

---

## Tab 3 — Activities (Screen 11; 12–13 Task 010)

| Figma action | API | Status |
|---|---|---|
| List + category filter | `GET /v1/activities`, `category` | **PARTIAL** (ACT-CATALOG) |
| Search hosts/titles | `q` | **MATCHED** (025C) |
| Pagination | cursor/limit | **MATCHED** |
| Activated hosts only | `activity-host-eligibility` (025C) | **MATCHED** |
| Join / waitlist | RSVP routes | **MATCHED** |
| Host approve/decline queue | — | **NEEDS DECISION** (ACT-APPROVAL) |
| Map / miles / ratings | — | **MISSING** / **DEFERRED** |

---

## Tab 4 — Marketplace (Screen 20 → 024A–D)

| Figma action | API | Status |
|---|---|---|
| Product grid / detail | `GET /v1/store/products` | **MATCHED** |
| Favorites / cart | `/v1/me/store/favorites`, `/v1/me/store/cart` | **MATCHED** |
| Club member price / reviews / badges | — | **DEFERRED** (MKT-03, D-08, MKT-04) |
| Checkout / Place order | `checkout.status: UNAVAILABLE` | **UNAVAILABLE** (by design) |
| Geo / shipping / tax | — | **DEFERRED** (MKT-03) |

---

## Tab 5 — Profile & Settings (Screen 26 + Html → Body)

| Figma action | API | Status |
|---|---|---|
| Settings hub | `GET /v1/me/settings/overview` | **MATCHED** (main-app gate) |
| Edit profile / personal details | `GET/PATCH /v1/me/profile` | **MATCHED** |
| Legal name after KYC | `legalNameLocked` sticky (025D/025E) | **MATCHED** |
| DOB | Read-only on GET | **MATCHED** |
| Interests / favorites / avatar | Gated `/v1/me/*` | **MATCHED** |
| Blocks / privacy | `/v1/me/blocks`, `profileVisibility` | **MATCHED** |
| Sessions / password | Onboarding-safe security routes | **MATCHED** |
| 2FA / billing / meetup invites / delete | `capabilities` DEFERRED/UNAVAILABLE | **DEFERRED** |
| Host rating 4.98 | — | **MISSING** (COPY-TRUST) |

---

## Security & data truth (025E verification)

| Check | Result |
|---|---|
| Pending user blocked on all five tab APIs | **VERIFIED** (T025E-E02) |
| Activated user loads all five tab APIs | **VERIFIED** (T025E-E01) |
| Checkout remains UNAVAILABLE | **VERIFIED** on cart |
| Legal name lock survives KYC revocation | **VERIFIED** (T025E-S01) |
| Legal name lock survives provider expiry + cleared user KYC fields when staff approval audit exists | **VERIFIED** (T025E-S02) |
| De-activated discover targets removed from people search | **VERIFIED** (T025E-E03) |
| No fabricated geo, stories, ratings, presence, Club prices | **Policy enforced** — see phase docs |

---

## Release blockers (Main Flow backend)

| ID | Blocker |
|---|---|
| D-04 | Radius/map/nearest-first/presence |
| D-06 | Home stories row LIVE |
| MKT-03 / D-08 | Checkout, Club pricing, fulfillment |
| ACT-APPROVAL | Host RSVP approval mode |
| HOME-08 | Authoritative Home variant |
| COPY-TRUST | Marketing metrics without server backing |
| SET-03 | Destructive account deletion |
| Full Neon regression | Deferred to release gate |

**Task 025 engineering status:** Phases **025A–025E complete** within approved backend scope. **Not** 100% Figma feature parity or production readiness.
