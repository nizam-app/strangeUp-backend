# StrangeUp — Task 017: Membership Plans & Entitlements Foundation (BACKEND ONLY)

**Task type:** Implement a cohesive, safe, Figma-grounded backend membership capability, not a documentation-only task.  
**Stack:** Node.js, TypeScript, Express 5, Prisma 7, PostgreSQL (isolated Neon development and integration-test databases).  
**Starting evidence:** Owner-supplied Cursor Task 016 report, 2026-10-27 — 151 unit tests passed; 92 integration tests passed + 1 intentional skip; latest additive migration `20261027240000_community_stories_media_polls` applied to `strangeup_dev` and `strangeup_test`. Re-verify in the current repo; do not represent this report as independently re-run. Tasks 006–016 must remain intact.  
**Product decision state:** D-08 membership/commercial terms, MKT-03 checkout, consent canonical IDs and payment processor are **not approved**. This task **does not authorize paid subscriptions, live prices, trials, or premium entitlements**. D-06 group-media routes must remain default-disabled and unaffected.

## 1. Mission and actual Figma evidence

Implement an integration-tested, **honest membership plan catalog and self-membership/entitlement status**, compatible with a later approved billing provider and server-authenticated subscription events. Reuse account, Settings, Identity, Discovery, Activities, Groups, Store and Jobs architecture. Avoid a large speculative billing engine and avoid stopping at planning.

The original `Screen 18_ Membership Plans.pdf` in `Strange up(1).zip` visually shows:

- **Basic Explorer** (`$0/mo`), and **Strangeup Club** (premium tier).
- Monthly / Yearly display switch; annual presentation of **`$6.49/mo`, billed annually `$77.88/yr`**, marketing claims of a 7-day trial and an annual discount.
- **Basic Explorer** illustrative features: up to three monthly activity joins, five-mile discovery radius, community chat and messaging, ID-verification badge.
- **Strangeup Club** illustrative features: unlimited discovery/radius, curated interests, private circles, radar boosting, VIP perimeter, concierge service.
- Upgrade CTA, Apple Pay marketing line, account-managed subscription copy.

**These are Figma copy/examples, not approved commerce terms or evidence of implemented product functionality.** Especially: map/radius not implemented; no verified ID badge without trusted KYC; no monthly RSVP cap previously approved; no live concierge/priority feed; Apple Pay and real billing not configured. Preserve approved real-world KYC gates across free and premium tiers. Re-open the source PDF and inspect the actual rendered screen for parity.

## 2. Non-negotiable boundaries

1. **Backend only:** no Flutter repo, Flutter code, production, external checkout/purchases, vendor accounts, commits, pushes, DB resets or historical migration rewrites without explicit authorization.
2. **No monetary side effects:** no create-payment-intent, subscribe, trial-start, upgrade, downgrade, cancel-subscription or webhook endpoints that claim success. Do not store fictional paid entitlements or fabricate invoice/payment history. No live charge amounts until D-08 is approved and a real processor/product configuration is supplied.
3. **No client-granted premium state:** never accept plan, subscription, entitlement, verification or payment success from an ordinary authenticated client. No self-service write endpoint can grant `CLUB`.
4. **Membership != government ID verification.** Paid or basic plan status must never bypass Task 010 KYC gates or cause `APPROVED` KYC, public badges, activity seats, meeting instructions or special group roles.
5. **Keep current APIs and permissions unchanged.** Do not introduce `3 activities/month`, `5 miles` or enhanced/limited chat from the illustrative plan copy. No paywall on existing approved Tasks 006–016 operations. Don't enable `FOLLOWERS_ONLY` activity publishing or D-06 media access through membership.
6. **Runtime representation must be truthful:** active free plan vs future unavailable Club offer, not an active paid subscription. Explicit availability/capability values; no fake `trialEndsAt`, `nextBillingAt`, `autoRenew`, paid `subscriptionId`, payment method, upgrade button URL, entitlement expiry or verified badge.
7. **Privacy and safety:** JWT/session auth gates, current user self-only membership state, bounded catalog responses, privacy-preserving errors and no stored payment credentials.
8. **Re-use isolation:** Neon `strangeup_dev` and `strangeup_test` remain distinct; tests must never clean development or production DBs. Protect credentials from logging.

## 3. Implement membership catalog and self membership APIs

Reuse project routing, DTO envelopes and error codes; proposed paths (adapt if current conventions require):

- `GET /v1/membership/plans`: authenticated, eligible account; returns bounded plan offers with stable `BASIC` and `CLUB` identifiers, user-facing names and feature **availability**. Mark `BASIC` as `AVAILABLE`, price zero USD only if it matches existing user-account semantics; mark `CLUB` `COMING_SOON`/`NOT_CONFIGURED`, **not purchasable**. For prices, use `null` / explicitly unconfigured rather than silently pricing from Figma copy. Neither offer may claim operational benefits that are not implemented.
- `GET /v1/me/membership`: self-authenticated account membership status; existing users who have no approved billing subscription are `BASIC`/`FREE` or equivalent truthful default. Return current plan/capability set, `billingStatus: NOT_CONFIGURED`, `canUpgrade: false`, and reasons; no dates/payment methods/invoices unless actually backed by trusted persisted state.
- If helpful for Flutter Settings, add `GET /v1/me/membership/entitlements` or include `entitlements` in `/v1/me/membership` (prefer **one** consistent source of truth, not redundant endpoints). Capabilities should distinguish `AVAILABLE`, `UNAVAILABLE`, and `NOT_IMPLEMENTED` instead of pretending future premium features work.
- Integrate a compact membership capability summary into Task 015 `GET /v1/me/settings/overview` **without breaking existing response fields or changing settings authorization**.
- Preserve established API envelope `{ data, meta: { requestId } }`, OpenAPI schemas and exact enums consistent with current architecture. Never expose internal provider credentials, raw DB subscription keys or unapproved plan marketing as live functionality.

**Source-of-truth choice:** Prefer a small normalized `MembershipPlan`/availability catalog or a typed server-owned plan registry according to existing project standards. A plan model/migration is acceptable if it enables durable, future-expandable server-controlled plan semantics; do not manufacture a paid `Subscription` record, fake receipts or store arbitrary benefits as trusted user input. Avoid churn to `User` rows if computed BASIC status suffices. All future paid-state transitions must be designed to require a separate trusted billing mechanism and later explicit authorization.

## 4. Entitlement foundation with safe enforcement boundaries

- Centralize tier identifiers and *real* capability evaluation in one server-side module (rather than putting future paywalls in Controllers). Current BASIC access must match existing behavior. Paid-only features cannot be granted to a user until owner-approved product rules and verifiable trusted provider events exist.
- Keep KYC and membership independent: `hasFullAccountAccess`, D-03 viewer eligibility, blocked-user privacy, and KYC-01/ENF protections must remain their existing gates. Payment is never an identity proof.
- Where future plan benefits are documented (radius, spotlight, concierge, premium events, RSVP monthly cap, members-only rooms), return **NOT_IMPLEMENTED / POLICY_PENDING** and do not enforce them now; explicitly show dependencies on real geo, events, billing and D-08.
- No membership-inferred priority for existing Task 010 waitlists, activity joins, public profile rankings, direct messaging, group chat, community media, or Task 014 cart/jobs.
- Make entitlement decisions easy to unit-test, with a default-deny path for untrusted/premium-only operations. No test-only bypass in production code.
- Handle suspension, deleted/underage/ineligible states through existing policy. If account pending verification has read-only access elsewhere, mirror existing relevant conventions and document any deliberate membership-read access difference.

## 5. Pricing and consent: provisional owner decisions, not code assumptions

Add a **single short** D-08 commercial decision checklist within existing `docs/product/OPEN_QUESTIONS.md` and/or an owned decision file, but **don't stop at the checklist**. Capture precisely:

1. Actual product and billing channels: web Stripe vs mobile platform billing rules; currency/taxes/invoice requirements.
2. Whether Basic and Club are the final tier names and whether free plan is always default.
3. Whether `$6.49/mo billed annually ($77.88/yr)`, the monthly rate, 35% savings and trial are approved terms, including trial eligibility and cancellations.
4. Which claimed benefits are genuinely scheduled for build, priced, capped or removed from design (3 monthly RSVPs, 5-mile radius, enhanced discovery/priority, VIP roles, concierge, private circles).
5. Billing lifecycle: renewals, failed payments, grace periods, refunds/chargebacks, provider webhook verification, idempotency, entitlements and revocation.
6. Consent/terms identifiers and marketing accuracy for verified users, member badges and Apple Pay.

No fabricated premium users, no manual SQL plan grants to circumvent launch gating and no broad speculative payments APIs.

## 6. Database, migration, concurrency, tests

- Inspect `AGENTS.md`, `.cursor/rules/*`, current Prisma schema and migration catalog, Task 015 settings, Task 010 KYC, Task 014 checkout deferral, Task 016 D-06 gate, auth/session policy and real Neon setup/guards. Choose the minimal correct schema (possibly no migration if a server-owned static catalog with extensible abstraction suffices); document why.
- Only additive forward-only migrations if used; apply to both Neon dev and isolated test with current verified scripts. No destructive reset, no previous migration changes.
- Unit tests for tier registry, default BASIC state, unavailable Club/trial, no client-granted paid entitlement, no KYC substitution, null price/unsupported features, DTO allowlist and account status rules.
- Integration tests for catalog, own-plan state, authorization (401/403 per existing account policy), cross-user isolation, stable response values, settings overview compatibility and inability to gain paid entitlement from requests. Ensure no charge/order/payment/subscription routes are unexpectedly exposed. Test no regression in Task 010 RSVP/KYC and Task 014 `checkout.status=UNAVAILABLE` and Task 016 default `FEATURE_DISABLED` behavior.
- Run `prisma validate`/`generate`, `typecheck`, `lint`, unit, build and the **full Neon integration suite** once at milestone close. Run `format:check`; report existing Windows CRLF issues separately without repo-wide reformatting. Explain exact skipped test (previous intentional health-ready documentation block) and any new failures.

## 7. Documentation & Flutter backend contract

Synchronize:

- `docs/api/CURRENT_APIS.md` — **LIVE/VERIFIED** only for implemented routes, **COMING_SOON/NOT_CONFIGURED** for Club and billing; examples with explicit `null`/unavailable features.
- `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` — Figma Screen 18 data binding: Free selected by default for users without paid subscription, premium upgrade CTA disabled or coming-soon, pricing not advertised as live until D-08, never show KYC verified badge based on membership, no fake Apple Pay / payment / trial / receipts / successful subscription.
- `openapi/membership.yaml` (or consistent existing spec), `docs/plans/STATUS.md`, `ACTIVE_SCOPE_AND_DEFERRALS.md`, `docs/product/OPEN_QUESTIONS.md` and Figma Membership parity matrix. Keep Task 015 settings `capabilities` truthful; D-06 stays off. Do not modify Figma source PDFs.

## 8. Final report / completion criteria

Return one engineering report, not another decision-document-only milestone, with:

1. Actual implemented routes/methods and sample DTOs; what users can really do.
2. Distinction between `BASIC` live free capability and `CLUB` offering/paid enrollment not configured.
3. Source/migration files and Neon migration status.
4. Exact unit/integration test evidence and end-to-end regression counts, including 1 intentional skipped test if still present.
5. Evidence of no fake KYC, premium upgrade, price/trial, `FOLLOWERS_ONLY`, media Story activation or payment-success state.
6. D-08 owner decisions compactly itemized; production and legal/payment dependencies.
7. Unchanged D-06 and Task 014 checkout gates; no commits or pushes.
8. Recommendation of the next meaningful remaining backend milestone: approval-gated billing integration, D-06 activation hardening, retention/account deletion, or production readiness, depending on actual remaining Figma gaps.

**Work now on functional backend code and tests. Do not ask to select another task or block on unspecified commercial terms; leave those specific controls disabled and implement the safe scope.**
