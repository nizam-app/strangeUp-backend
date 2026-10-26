# StrangeUp — Product Requirements Draft v0.2

**Approval status: NOT APPROVED.** This is a source-grounded, architecture-ready **draft**, not a declaration that all pictured features ship in MVP.

## 1. Vision and platform

- **CONFIRMED (owner):** mobile product combining social discovery, people, groups, activities, meetup scheduling, communications, memberships, social engagement, small marketplace.
- **OBSERVED (exports):** registration/login, government ID and selfie verification, public profiles, nearby discovery/map filters, follow/wave/message actions, activities, group communities, 24h Stories, jobs, merchandise store and account safety/settings.
- **UNRESOLVED:** target countries, regulatory context, exact age eligibility, legal entity, budget/capacity, the precise MVP cutoff, and whether dating/mutual matching is part of the product at all.

## 2. Source design inventory

- 49 PDFs total, 39 meaningful UI screens/variants; 10 auxiliary exports.
- Prefer UPDATED Home export **47** and UPDATED Group Detail export **46** only as a **proposal**, not verified Figma authoritative selection; earlier counterparts are **01** and **09**.
- `SCREEN_TRACEABILITY.md` maps all screens to observed actions and candidate capabilities.

## 3. Actors (PROPOSED, not final role definitions)

- `Visitor`: unauthenticated user, public/auth entry points only.
- `Registered user`: authenticated, pending eligibility/verification checks.
- `Verified user`: optional verified eligibility attribute; NOT equivalent to an admin role.
- `Activity host`: resource owner with scoped activity-management rights.
- `Group owner / moderator`: scoped role for a specific group; not a global platform admin.
- `Platform moderator / admin`: secure privileged operational roles, with audited actions.
- `Merchandise fulfillment operator` and `Job publisher`: only if native commerce/jobs workflows are approved.

## 4. Proposed MVP boundaries (owner approval pending)

**MVP CORE (recommendation):** auth and session safety; basic editable profile and privacy; verification state orchestration (provider integration only when specified); block/report foundation; discovery; activity discover/create/join/host approval/waitlist; groups public/private join and group members; basic direct messaging; personal meetup invitation creation/response; notification center; minimal platform moderation/admin operations to respond to reports.

**MVP LIMITED / FEATURE-FLAGGED (recommendation):** membership catalog and entitlement contracts without charging actual customers; group posting / likes / comments; group chat only when membership authorization and moderation are tested.

**PROPOSED LATER PHASE:** live paid subscriptions, cart/payment/fulfillment, jobs application ecosystem, 24-hour Stories, polls, advanced social feed, sophisticated geo-ranking and ML-based matching. If business launch needs revenue or jobs on day one, revise this ordering explicitly.

The Figma UI exposes all of these but does not make their shipping order confirmed.

## 5. Functional stories and verification

| ID | Story / observable evidence | Evidence | Engineering acceptance target (PROPOSED) |
|---|---|---|---|
| AUTH-01 | User can sign up with first/last name, email, phone, password (33) | OBSERVED | Normalize unique identifiers; reject invalid input; password hashing; do not leak account existence. |
| AUTH-02 | Login via email/password, Apple/Google (31) | OBSERVED | Credential auth and social auth chosen after product decision; sessions revocable. |
| KYC-01 | Government ID selection and selfie verification (34,48,49) | OBSERVED | Track provider-session state and review, with minimal exposure/retention of biometric data. |
| PROF-01 | Edit profile, DOB, interests, avatar and visibility (37) | OBSERVED | Per-field validated PATCH; public DTO never exposes private data. |
| DISC-01 | Nearby people list/map; distance, age, verified filters (02) | OBSERVED | Location-aware filtered search with privacy guards and no exact coordinate disclosure by default. |
| SOC-01 | Follow, wave/hi, messaging from profile (03,02) | OBSERVED | Implement only after initiation/consent/eligibility rules are approved. |
| ACT-01 | Create and publish activity with venue, capacity, waitlist, verified-only audience (07) | OBSERVED | Host-authorized mutation; timezone semantics and race-safe capacity validation. |
| ACT-02 | Join/manage/leave/approve requests (04–06,41) | OBSERVED | Explicit join transitions; no duplicate active registration or overbooking; notifications consistent. |
| GRP-01 | Public/private groups, join request, admin approval (08,43–45) | OBSERVED | Resource-scoped admin controls, durable membership/request records. |
| GRP-02 | Community posts, stories, chat and meetups tabs (09,46) | OBSERVED | Post/Story/chat data visibility and moderation policies needed before enabling. |
| CHAT-01 | Direct/group messages, requests, read indicators, media and meetup card (10–11) | OBSERVED | Conversation ACL, durable messaging, deduped sends, attachment validation. |
| MEET-01 | Invite and respond to personal meetup (38–40) | OBSERVED | Separate invitation lifecycle, recipient authorization, time zone handling. |
| MEM-01 | Basic/Club, trial, monthly/yearly display (12,42) | OBSERVED | Server-side entitlements and provider-verified purchase flow when launch details are approved. |
| STORE-01 | Official gear variants, cart, member prices, shipping/pickup (13–15) | OBSERVED | Snapshot price/tax/discount and idempotent order lifecycle, after pricing/fulfillment decisions. |
| JOB-01 | Search/save/apply/track jobs (23) | OBSERVED | Decide native applications vs external referral; define publisher permissions. |
| NOTIF-01 | Notification inbox, mark read, actions (36) | OBSERVED | User-scoped notifications; deep-link/action authorization and deduplication. |
| SAFE-01 | Blocking, privacy, security, account deletion (25,37) | OBSERVED | Resource-wide block/suspend policy, reporting and deletion audit/retention rules. |

## 6. Nonfunctional requirements (PROPOSED baseline)

- APIs versioned and documented with OpenAPI; typed validators; stable error codes; consistent pagination.
- DB referential integrity, unique constraints, transaction-safe joins, idempotent critical writes.
- Explicit PII field classification, logging redaction, secrets management, rate limits and authenticated access.
- Mobile network resiliency; retries cannot multiply orders, invites, registrations or chat messages.
- User account lifecycle: suspensions, data subject deletion/retention decisions, backup/recovery, auditability.
- No numerical SLA/latency targets are approved. Establish them after first load assumptions.

## 7. Exclusions and assumptions policy

An omitted screen is not grounds to invent product entitlement, cancellation fees, booking charge, verification verdict, chat permissions, profile visibility rules, seller marketplace or employer dashboard. Record proposals in `OPEN_QUESTIONS.md` and hold affected feature flags off until approved.
