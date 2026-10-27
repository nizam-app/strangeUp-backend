# Figma parity — Task 014 (Marketplace, Merchandise & Jobs)

**Evidence:** Screen 20–23 PDFs in `Strange up(1).zip` (read-only).

| Figma | Backend (Task 014) | Status |
|---|---|---|
| Screen 20 — gear grid, categories, search, favorites entry | `GET /v1/store/categories`, `GET /v1/store/products`, favorites under `/v1/me/store/favorites` | **LIVE** (published catalog only; empty DB valid) |
| Screen 20 — demo ratings / member price on cards | Not exposed in API DTOs | **DEFERRED** (MKT-03 / no fabricated scores) |
| Screen 21 — variants, stock, images, add to cart | `GET /v1/store/products/:id`, cart `PUT /v1/me/store/cart/items/:variantId` | **LIVE** |
| Screen 21 — reviews, verified badges, membership price | Not implemented | **DEFERRED** |
| Screen 22 — cart lines, subtotal | `GET /v1/me/store/cart` with `subtotalCents` | **LIVE** |
| Screen 22 — taxes, discounts, saved card, place order | `checkout.status=UNAVAILABLE` | **DEFERRED** (MKT-03) |
| Screen 22 — shipping/pickup selection | Not persisted (no address/fulfillment policy) | **DEFERRED** |
| Screen 23 — explore/search/filter jobs, saved, apply | `GET /v1/jobs`, saved jobs, applications | **LIVE** (published listings only) |
| Screen 23 — miles/nearest, official partner, applicant counts | Not in API | **DEFERRED** (JOB-01/03) |
| Screen 23 — application progress to employer | `employerDelivery.status=NOT_CONFIGURED` on applications | **DEFERRED** (JOB-02) |
| User job posting | Author **DRAFT** only via `/v1/me/job-listings` | **LIVE** (non-public) |
| Screen 18 membership pricing | Out of scope Task 014 | **DEFERRED** |
