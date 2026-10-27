# StrangeUp — TASK 014: Marketplace, Merchandise Catalog, Cart & Jobs Backend

**Mode:** one meaningful Figma-backed BACKEND implementation milestone; implement working code now, not another planning-only task.  
**Stack:** Node.js / TypeScript / Express 5 / Prisma 7 / PostgreSQL (existing isolated Neon `strangeup_dev` + `strangeup_test`).  
**Prior verified baseline (Cursor report, Oct 27 2026):** Task 013 finished: 132 unit tests passed (30 files); 76 integration passed + one intentional skipped placeholder (10 files); `20261027210000_user_notifications` applied to both Neon databases. Tasks 006–012 were included in the regression suite. Recheck repo truth; reported success is not independent production sign-off.

## 0. Mission & original Figma evidence

Build the independently supportable backend for StrangeUp's **official gear/community merchandise store** and **Jobs discovery/application experience** in one section, using approved privacy/security foundations. Implement source, additive migrations, endpoints, validation, unit tests, integration tests, OpenAPI, Flutter API handoff and a full engineering report. Avoid hard-blocking safe catalog, cart and jobs features on missing payment, employer verification or moderation integrations.

Read and **visually inspect** the ORIGINAL PDFs in `Strange up(1).zip` (use actual rendered screens, not guessed functionality):

- `Screen 20_ Marketplace.pdf`: searchable official/community gear grid; categories `All Gear`, `Cycling`, `Running`; example item favorites; product cards with demo price/rating/member price; shop/cart entry; pickup/shipping claims.
- `Screen 21_ Product Details.pdf`: product images, size/color variants, variant stock, quantity, favorite, price/compare-at price, membership price, shipping/pickup choice, add to cart and buy now; reviews and verified badges are **sample UI copy**, not evidence of real records.
- `Screen 22_ Cart & Checkout.pdf`: line items, quantity, fulfillment selection, subtotal, discount/taxes, saved card and place order. **No payment gateway, tax engine or purchase authorization is approved.**
- `Screen 23_ Jobs.pdf`: Explore Jobs, search, location/category/type filters, Saved, Applications, featured cards, employment type and pay range, Apply Now and application progress. “nearest”, miles, “official partner”, “active host”, applicant counts and review/status tags are illustrative until verified.
- `Link - Tab 4_ Jobs (ACTIVE).pdf`: only minimal navigation text; do not invent missing employer-management UI from it.
- `Screen 18_ Membership Plans.pdf` only to flag unapproved memberships/pricing dependency; do **not** implement paid plan claims in Task 014.

**Scope interpretation:** `Screen 20` is a StrangeUp-curated/official **merchandise** storefront, **NOT** evidence of a user-to-user seller marketplace, payouts, third-party vendor onboarding or an admin backoffice. `Screen 23` is a **job board**, but does not establish a verified employer publishing workflow. No fictitious product inventory, job positions, reviews, applicant counts or partner badges may be seeded as actual public production data. Test fixtures may use synthetic data inside the isolated test database.

## 1. Absolute boundaries

- BACKEND ONLY; Flutter team has separate repo. No Flutter modifications, production changes, commits, pushes, resets/drop operations, old migration rewrites, `.env` disclosure or silent provider integration.
- Keep Tasks 006–013 intact. Reuse JWT/session, full-account eligibility (18+, active, email-verified), D-03/D-04 profile visibility, bidirectional block checks where user-owned actors are exposed, rate limit and error envelopes, existing image sanitization, existing cursor conventions and existing Neon identity guard.
- Government-ID KYC is **not** automatically needed to browse official merchandise or jobs. Never imply KYC or membership approval based on email verification. Existing Task 010 KYC enforcement remains exclusive authority over activity participation/meetup access.
- **No LIVE payments/charges/checkout orders** without selected processor and approved tax, fulfillment, refund, discount and inventory reservation policies. No fake Visa card, Apple Pay, club entitlements, 15% discounts, 4.9 ratings, shipping estimates, confirmed pickup, order QR, 30-day warranty or guarantee.
- **No self-service seller/employer verified/official badge.** Publishing merchant products or job postings requires a trusted content-management/authorization mechanism and explicitly approved business policy. In absence of it, implement safe owner-controlled catalog ingestion and job draft authoring, but don't make untrusted user drafts publicly LIVE by default. No fabricated paid/verified listings.
- All money: precise integer minor units (e.g. cents) plus explicit ISO currency (`USD` if legitimate seed/publisher input), never floating-point for persisted or computed currency. A product catalog list price is not an authorized final payable price.
- No precise coordinates, radius, computed distance, ETA, shipping/carbon-neutral claims or geographical ranking. City and region are unverified labels, not “3.2 miles away.”
- No resume/ID document storage, external contact extraction, or emailing job applications unless separately approved. Do not expose applicant identity to public searches.
- D-06 Groups and D-18 Notification retention are still OPEN. Preserve status. Don't start Stories/photo post/notification transport as part of this task.

## 2. Merchandise data model & safe catalog publication

Implement bounded, additive models as appropriate to existing Prisma naming: e.g. `StoreCategory`, `StoreProduct`, `StoreProductVariant`, `StoreProductImage` (or reuse existing safe media reference structure), `StoreFavorite` and `StoreCartItem` plus `StoreCart` only if necessary.

- Product: UUID; stable slug; sanitized title/description; category; explicit `DRAFT` / `PUBLISHED` / `ARCHIVED` lifecycle; timestamps; optional trusted origin flag set **only** through restricted trusted seed/admin mechanism. No public “official/verified” label until backed by approved data provenance.
- Variants: UUID; product foreign key; bounded structured option attributes (size, color, etc.); validated SKU unique where used; **nonnegative** stock quantity; base price in cents; explicit currency; compare-at price only if trusted source; active flag; constraints/indexes for catalog/search. No price inference from screenshot.
- Product imagery: reuse sanitized image-processing pipeline; files locally only in dev. Public only for PUBLISHED products, with safe ownership/path checks; no external arbitrary file paths. If the repo has no trusted catalog media/publisher mechanism, implement consistent placeholder-free empty images and record ingestion requirements; do not invent production CDN.
- Controlled publication: reuse existing trusted admin role only if genuinely present, otherwise keep publishing/ingestion internal to a secured operator-only seed/CLI or **explicitly deferred**. Public APIs list only genuine `PUBLISHED` catalog records; fresh DB may legitimately return `[]`.
- Immutable price/currency source records may change under authorized management. User cannot tamper with unit prices by submitting payloads.
- Filter/search by category, text, optional supported size/color and bounded cursor pagination; deterministic stable order by known fields, no fabricated popularity ranking/review scores.

### Merchandise APIs (proposals; follow repository conventions and avoid route conflicts)

| Method | Path | Safe contract |
|---|---|---|
| `GET` | `/v1/store/categories` | Real active product categories only; eligible authenticated viewer unless existing approved anonymous browse policy |
| `GET` | `/v1/store/products` | Published products; `q`, `category`, variant-attribute filters, `cursor`, `limit`; no fake ratings/member price |
| `GET` | `/v1/store/products/:productId` | Published product/variant details; safe stock visibility; not checkout |
| `GET` | `/v1/store/products/:productId/images/:imageId` | Only sanitized, authorized public catalog bytes if source exists |
| `GET` / `PUT` / `DELETE` | `/v1/me/store/favorites[/:productId]` | Self favorites; idempotent; not visibility for unpublished items |
| `GET` | `/v1/me/store/cart` | Current self cart, joined to catalog/variant state and server prices |
| `PUT` | `/v1/me/store/cart/items/:variantId` | Quantity set (bounded); replaces one line; zero removes; server validates stock/status/currency |
| `DELETE` | `/v1/me/store/cart/items/:variantId` | Idempotent self-only remove |
| `DELETE` | `/v1/me/store/cart` | Idempotent clear; no order side effects |

Cart totals: subtotal in cents from current trusted catalog price only, with `checkoutStatus: "UNAVAILABLE"` and a reason/code when essential tax/fulfillment/payment policy is not live. **No valid “Place Order”/charge/payment intent/order paid route**, no fake final total; indicate subtotal excludes unknown tax/shipping/discount. Product pricing may be out-of-date as stock changes; revalidate on read/update. Cart mutation must never decrement inventory. Concurrency and stock editing must not oversell because no purchases are executed; future orders will need atomic reservation.

## 3. Jobs domain: discover, save and apply without fake employers

Implement additive `JobListing`, `SavedJob`, `JobApplication` (and separate trusted employer/organization identity only where an approved authorization model exists). Use accurate lifecycle states for unpublished drafts and approved public postings; do not grant `PUBLISHED`/`OFFICIAL_PARTNER` status solely because an eligible user created a listing.

- Jobs: UUID, role/title, description, company display label, optional city/state, optional workMode (`ONSITE` / `REMOTE` / `HYBRID` when author-supplied), employmentType (`FULL_TIME`, `PART_TIME`, `CONTRACT`, `PER_SESSION` as approved catalog values), pay band in integer minor units with explicit currency + period if disclosed, timestamps, `DRAFT` / `PUBLISHED` / `CLOSED` / `ARCHIVED`. No invented normalized yearly pay where the listing quotes hourly/per-session, no applicant counts unless backed by DB and policy.
- Trusted listing publication can reuse an existing moderator/admin role **only if confirmed by repository**; otherwise drafts stay nonpublic until a later publisher approval solution. Manual trusted seed/import may be used for real approved listings; **never** treat synthetic example jobs from Figma as live actual openings.
- Read/public job detail only when PUBLISHED and open/valid; cursor pagination, search `q`, category/type/workMode/city/region, sort by createdAt/id (not nearest). Rate limit anti-scraping as appropriate.
- Authenticated eligible user saves/unsaves listing idempotently; self-only Saved page.
- Applications: explicit submit action by applicant for a real currently-open published job, with a *minimal* allowlisted text message/cover statement and application consent version if existing consent registry supports it. **No automatic disclosure of full profile**, email/phone, verification status, precise location, resume upload or user contact details in response. Do not silently submit to outside company, website, email, ATS or third-party employer.
- Application submission must persist securely and expose own status (`SUBMITTED` / `IN_REVIEW` / `WITHDRAWN` / `DECLINED` / `ACCEPTED` only when trustworthy actors can change it; never invent progress). One active application per applicant/job or explicitly documented idempotency; unique constraint and concurrency tests. Decide whether revisions/withdrawals allowed conservatively; never imply actual employer notification if no mechanism exists.
- Employer-side reads/updates only via a verifiable authorized owner/approved operator mechanism; if none exists, **do not add publicly accessible applicant-review API**. It is acceptable for applicant submission and self-tracking to be functional while external employer delivery is clearly **DEFERRED**. Applicants must not think the application has reached the real employer until delivery is backed by an approved workflow; public API and Flutter handoff must disclose this distinction.
- No paid jobs/boosts, employer verification badges, candidate scoring, CV processing, or approval claims. Job contact privacy & retention remain owner decisions, tracked with minimal temporary data and no legal completeness claim.

### Jobs APIs (proposed)

| Method | Path | Safe contract |
|---|---|---|
| `GET` | `/v1/jobs` | Only genuinely published/open jobs; filters/paging |
| `GET` | `/v1/jobs/:jobId` | Published detail with limited company fields |
| `GET` | `/v1/me/saved-jobs` | User's saved published listings |
| `PUT` / `DELETE` | `/v1/me/saved-jobs/:jobId` | Idempotent save / unsave |
| `POST` | `/v1/jobs/:jobId/applications` | Submit only to valid, authorized *in-platform* destination; otherwise fail closed/defer rather than fake external delivery |
| `GET` | `/v1/me/job-applications` | Self status/cursor |
| `GET` | `/v1/me/job-applications/:applicationId` | Applicant-only detail; 404 for others |

If independent users need to post jobs, implement an **author-only DRAFT create/edit flow** as safe progress, with zero implicit publishing/official status. Document missing authorization/publisher rules in the consolidated decision list rather than building fake LIVE jobs.

## 4. Authorization, moderation, privacy & data handling

- Existing eligible viewer gate for store and job screens unless approved otherwise; protected self APIs require current session and self scoping. Cross-account IDs from requests must never select writable owner identities.
- Blocked/hidden user profile rules apply if surfacing actual poster or person previews; do not treat company-name text as a verified organization identity.
- Private cart/favorites/applications must not be exposed via public DTOs, home feeds, notifications, public user profiles or arbitrary IDs. Non-owner protected reads `404` by existing convention.
- Block status, listing archival and entitlement changes should be enforced at read/action time. Mutations validating stock/price/status should use transactions/locking where concurrent edits require it; avoid fake confirmed reservations.
- API response/error contracts: existing `{data,meta.requestId}` and `AppError` shape; `400` strict Zod, `401` bad auth, `403` eligibility denied, `404` hidden/missing, `409` genuine state conflict only; do not catch all connection errors and turn them into `409`.
- Ensure bounded text, safe image bytes and output, rate limiting, no untrusted HTML injection, strict idempotency and stable cursor pagination. Never expose unpublished inventory, job applications of others or sensitive payment data.
- Do not store/payment-card display, CV/ID documents, delivery addresses, addresses of meetup locations, phone/email for fulfillment until policy and integration approved.

## 5. Pending business-policy questions (ONE concise batch, implementation should continue)

Record recommended choices as **PROVISIONAL**, no auto-owner approval; use conservative safe behavior rather than fabricating feature completion:

1. **MKT-01** Is this platform-only curated merch, third-party merchant marketplace or both? Figma proves a community/official gear storefront, not vendor onboarding.
2. **MKT-02** Who can publish products, manage variant stock, choose official status and provide pricing? Trusted operator-only until role/permission approved.
3. **MKT-03** Taxes, payment provider, refunds, actual fulfillment, pickup authorization, shipping service levels, inventory reservation, membership discounts and checkout enabling: DEFER until real policies/integrations; no fake checkout.
4. **MKT-04** Product photos, public reviews/ratings, favorites, catalog images and moderation/rights: local/dev media only until production storage and review policy.
5. **JOB-01** Who can publish jobs and assert official partner/verified employer status? Owner-approved employer/publisher verification needed.
6. **JOB-02** What employer delivery channel, applicant consent disclosure, job retention/privacy, job reports/moderation? Until approved, avoid claiming employer delivery; applicant-only tracking of saved/application states can be implemented safely as applicable.
7. **JOB-03** Salary/compensation display, role category, remote work and location: self-reported labels; not verified, no radius or distance.

An explicit approved decision overrides conservative provisional defaults. Do not stop coding independently supportable features while collecting answers.

## 6. Database quality, integration and regression

- Read `AGENTS.md`, `.cursor/rules/*`, existing repo schema, existing `docs/plans/*`, `docs/decisions`, module conventions and current APIs. Do not duplicate Groups, Social, Activities or Home models, route prefixes or product semantics.
- Use existing verified Neon `.env` / identity guard. Inspect DB URLs safely without printing full URI/credentials. Confirm `current_database()` is `strangeup_dev` vs `strangeup_test` and ensure no integration test cleanup can target `strangeup_dev`/prod. No destructive resets. Check Prisma migrations drift before any change.
- Add forward-only Prisma migrations (one or a few meaningful ones) for approved safe schema, seeded catalogs only if legitimately authorized source data exists. Synthetic demos **only in tests**. Apply to BOTH dev/test with existing scripts after inspection.
- Focused unit tests: Zod DTO allowlists, catalog and job query filters, money arithmetic overflow/quantity caps, state transitions, seller/publisher provenance restrictions, privacy and owner access, idempotent favorites/save/apply and cart subtotal rules.
- Integration: catalog publication isolation; stale variant/stock/cart sync; cart privacy/tampering; no fake payment; valid job listing filters; saved jobs; applicant state isolation; concurrent duplicate application; closed/archived job denial; publisher/owner ACL; block/profile redaction where applicable. Assert mocks/published fixture data never persist to dev. Re-run full Tasks 006–013 suite on isolated Neon test DB ONCE at section closure; avoid micro-run repetition.
- Run Prisma validate/generate, typecheck, lint, `format:check`, all unit tests, build, complete Neon integration suite. Deal with known Windows CRLF warnings without rewriting unrelated files for cosmetic reasons. Report exact result counts and the existing skipped test name/reason.
- No fake success on unauthenticated/public actions or simulated payment/job application delivery; error paths must be tested end-to-end.

## 7. Flutter API handoff, status and final report

Update `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` (new Section 17), `openapi/store.yaml` / `openapi/jobs.yaml` (or repo conventions), `docs/plans/STATUS.md`, `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md`, `docs/product/OPEN_QUESTIONS.md`, and a new `FIGMA_MARKETPLACE_JOBS_PARITY_TASK014.md`.

For each route: exact method/path, status (LIVE/TESTED/DEFERRED), JWT gate, input/output DTOs, pagination, error/status codes, empty states, safe image URLs, consent and state indicators, privacy, client messaging. State clearly that `Place Order`, actual payment, prices including all taxes, exclusive membership discounts, reviews, verified merchants, pickup/delivery confirmation and real employer delivery are NOT LIVE unless truly implemented and tested with approved sources.

Return one comprehensive engineering report: what implemented; which Figma screens covered; new/modified files and migration identities; exact endpoint inventory with LIVE vs planned; DTO examples; owner decisions pending; database/migration evidence without secrets; unit/integration/full regression counts and skipped cases; authorization and concurrency invariants; detected risks and release blockers; Git status; recommended next Figma section (remaining Stories/media, Screen 18 membership/subscriptions, Screen 26 settings/account lifecycle, or approved marketplace checkout provider work). No Git commit/push, production, Flutter modifications or destructive DB operations.
