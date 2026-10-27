# StrangeUp — TASK 010: Activities & Meetups Backend (Figma Screens 11–13)

**Type:** Substantial BACKEND implementation milestone, not documentation-only planning.  
**Stack:** Node.js / TypeScript / Express / Prisma / PostgreSQL.  
**Source:** Original Figma PDFs `Screen 11_ Activity Discovery.pdf`, `Screen 12_ Activity Details.pdf`, `Screen 13_ Create Activity.pdf` (and Dashboard `Screen 08_ Home Dashboard.pdf` for reuse).  
**Status:** Proposed next implementation task. Follow all existing owner-approved KYC-01/03/05/ENF and D-03/D-04 decisions. Do not treat inferred activity-business defaults as owner-approved policy.

## 0. Cursor execution order

1. Read `AGENTS.md`, `.cursor/rules/`, `docs/plans/STATUS.md`, `ACTIVE_SCOPE_AND_DEFERRALS.md`, `OPEN_QUESTIONS.md`, all approved identity/KYC decisions, current API/OpenAPI and Flutter handoff, Prisma schema, and current Task 009 services/policies.
2. Inspect the **actual three Figma PDFs**. Inventory real controls and compare source. Reuse existing auth, policy, user visibility/blocking, avatar/media sanitization, interests, error envelope and pagination implementations. Do **not** rebuild Tasks 006–009.
3. Implement a coherent Activities backend: controlled catalog, host draft lifecycle, safe listing/detail, participation/capacity, waitlist, cancellation and KYC enforcement. Write tests as you code and sync all API docs.
4. For genuinely open product choices, implement only conservative safe capabilities or explicit unavailable states. Record a **single concise decisions table** as part of final report, not a preliminary documents-only stop. Do not invent approved rules.
5. Run fast code quality and unit tests as you work. Write complete DB integration tests; do not repeatedly troubleshoot Prisma Dev or claim database verification. Native PG is still blocked by owner-local `.env` `YOUR_PASSWORD`; leave Profile/Discovery/Activities verification explicitly pending until test DB is available.
6. Deliver one real implementation report with code paths, endpoints, auth/KYC matrix, tests, limitations, and next section.

## 1. Figma screen-to-capability map

### Screen 11 — Activity Discovery
- Activity cards: cover, title, category labels, start time, venue/city, host preview, attendee count/capacity, spots left, Join action.
- Search/filter categories and list view. Build **non-geospatial** list and search; avoid map, miles-away chips, Nearby radius/Within 5 miles, or proximity ordering. Do **not** fake coordinates, host verification badges, attendance, or activity records.
- Reuse this list service for the later Home Dashboard preview; dashboard is not part of this task.

### Screen 12 — Activity Details
- Public-safe activity description, date/time, capacity, host preview, venue display name, pace/skill and gear notes if applicable, attendee count, Join action.
- **Do not reveal exact meeting instructions, exact point or attendee identities to a browser who has not joined.** Expose approved meeting guidance only to host and appropriately confirmed, currently eligible participants. Flutter must know which fields are conditional.
- Host metrics, star ratings, "100% verified" and other examples in the mockup are **not** backend facts. Do not fabricate them.

### Screen 13 — Create Activity
- Draft/Publish, activity name, category, description (Figma counter `500`), optional cover, date/start/end, venue and meeting-point instructions, capacity, automatic waitlist, verified-attendee setting, visibility choice `Public (Nearby)` / `Followers Only`.
- Source copy says users can edit/cancel until two hours prior; this is **not an owner-approved business policy**. Do not silently lock edits at two hours; flag for owner. No payment features in this free MVP.
- The on-screen option "Only Allow Verified Members" **must not allow unverified users into real-world meetups**: approved KYC gating overrides an optional toggle.

## 2. Activity domain model (adapt naming to existing conventions)

Design additive Prisma schema and forward-only migrations, with appropriate indexes, FKs and constraints:

- `Activity` with stable UUID, `hostId`, title, bounded description, category key(s) from a managed catalog, optional safe cover-media reference, `startsAt`/`endsAt` UTC and IANA `timeZone`, `mode` (IN_PERSON, VIRTUAL, HYBRID), `status` (DRAFT, PUBLISHED, CANCELLED, COMPLETED or justified existing equivalents), `audience` (PUBLIC, FOLLOWERS_ONLY reserved), display `venueName` / `locationCity` / `locationRegion`, **private** `meetingInstructions` and optional virtual meeting details, positive `capacity`, `waitlistEnabled`, created/updated timestamps. Separate public-safe and private meeting-point fields.
- Managed `ActivityCategory` vocabulary grounded in Figma (Biking, Padel & Tennis, Running, Swimming, Fitness, etc.). Do not assert the profile Interests catalog is automatically identical. Use explicit stable keys and seed idempotently if a catalog is needed. Keep uncertain mappings in a single open-decision row.
- `ActivityParticipation`/`ActivityRSVP`: unique `(activityId,userId)` and explicit state for confirmed/cancelled/waitlisted as appropriate. Do not infer counts from mock UI. Use stable timestamps and server-authoritative participant IDs.
- `ActivityWaitlist` or a unified RSVP state with deterministic ordered position. Decide a schema with unambiguous unique membership and FIFO promotion.
- Optional cover media: reuse the hardened byte-validation/re-encode/opaque storage-key mechanism from Task 008A. Local storage is **development-only**. Avoid raw storage paths in public DTOs and do not weaken avatar privacy or local filesystem protections.
- Consider indexes for published future starts, category, location text, host and participant lists. Avoid unsafe or unbounded queries.
- No fake seed attendees or user accounts; test fixtures only inside tests.

## 3. Route contract (adjust only if repository already has a consistent equivalent)

| Method | Proposed route | Purpose and authorization |
|---|---|---|
| `GET` | `/v1/activities` | Eligible authenticated adults browse published discoverable activities; bounded cursor pagination; text/category/city/region/date filters, no geodistance |
| `GET` | `/v1/activities/:activityId` | Eligible viewer reads public-safe details; no hidden meeting info or unauthorized host profile fields |
| `POST` | `/v1/me/activities` | Eligible authenticated host creates DRAFT; no claim of live event until publish succeeds |
| `GET` | `/v1/me/activities` | Host sees own drafts/published/cancelled and attendance summary, authenticated self only |
| `PATCH` | `/v1/me/activities/:activityId` | Host-only safe updates with state transition rules; no arbitrary mass assignment or rescheduling confirmed attendees silently |
| `POST` | `/v1/me/activities/:activityId/publish` | Host-only publish, trusted KYC gate for real-world/hybrid, audience and validation rules |
| `POST` | `/v1/me/activities/:activityId/cancel` | Host-only cancellation; prevent subsequent joins and record affected participation safely |
| `POST` | `/v1/activities/:activityId/rsvp` | Join a published activity if eligible, not blocked, not host, space available, and KYC-approved for real-world/hybrid |
| `DELETE` | `/v1/activities/:activityId/rsvp` | Self cancellation/leave with idempotent safe semantics; handle waitlist promotion through KYC checks |
| `GET` | `/v1/me/activity-rsvps` | Self-only confirmed and waitlisted activity summaries (screen Settings → My Activities) |
| `GET` | `/v1/activities/:activityId/meeting` | Host or confirmed participant only, eligibility and KYC rechecked; never public exact guidance |

If the existing API conventions prefer `/v1/activities/:id/participants` or different resource nesting, use them consistently and report actual paths. Do not create an unauthorised attendee roster just because screen examples show faces. For waitlist position in self responses, prevent disclosure of other members' identities. For check-in/invitation, defer endpoints unless implementing those flows faithfully; preserve approved server-side KYC enforcement as a prerequisite for any later check-in/invitation API.

## 4. Non-negotiable approved KYC, privacy and membership rules

1. Browse/list/detail: active authenticated, email-verified, age-eligible viewers can browse appropriate published activities **without** KYC; profile-specific host fields must still observe Task 009 D-03 visibility and blocks.
2. Real-world (`IN_PERSON` or `HYBRID`) hosting **publish/activate**, join/RSVP acceptance, and check-in (if built) require **current trusted government-ID KYC APPROVED**. Reject stale/expired/revoked/failed/pending and user-supplied status. Never infer KYC approval from email verification. No provider is integrated; production must fail closed until provider-backed approval is possible.
3. Virtual-only flows may be KYC-exempt under approved KYC-ENF rules. This does **not** exempt account eligibility, blocks, moderation, or registration protections.
4. Full-capacity waitlist entry can be allowed to eligible unverified adults where previously approved; **promotion to confirmed participation must recheck KYC** for real-world/hybrid. Do not silently promote ineligible users or misrepresent confirmation. Define safe deterministic behavior when the first person is not eligible (do not silently bypass users without an approved queue policy); document the decision boundary.
5. No client claims about verified status, capacity, host ownership, RSVP approval, waitlist rank or attendee counts are authoritative. Derive from DB.
6. Bidirectional blocks between the viewer/participant and **activity host** must be enforced for activity list/detail, RSVP and private meeting details. For any future attendee identities that are actually exposed, apply viewer↔attendee block checks as well. Do not perform unnecessary all-participant block scans or leak attendee identities. If a block changes, re-check at detail/RSVP/meeting access. Maintain conservative uniform hiding behavior where needed.
7. Audience `FOLLOWERS_ONLY` is **not ready** until an actual approved Follow graph exists. It may be represented as draft/pending choice but **must not be published or accessed under a fake followers filter**. `PUBLIC` means discoverable to eligible authenticated users; it does not enable anonymous or geospatial public search.
8. Exact venue/meeting instructions are sensitive and are different from the general city/region display. Do not leak private instructions via public list/detail, error logs, OpenAPI examples, or search indexes. No coordinates, geocoding, driving route or radius without new approved rules.
9. Avoid automatically publicly exposing private Profile.favoriteActivities (preference pins) as real `Activity` entities; this is a distinct model.
10. Activity creation/editing/participation is free-only for this MVP. Payments, ticketing, membership entitlements and refund logic are not approved here.

## 5. Data consistency, capacity and cancellation

- RSVP capacity must be atomic under concurrent requests: transaction and real PostgreSQL row locks or equivalent safe, documented native pattern; never overbook. Existing PGlite behavior is not proof of correctness. Idempotent duplicate join cannot consume two seats. Apply proper uniqueness constraints and retries/error codes only for known cases.
- Dates: validate `endsAt > startsAt`, future publish, timezone, capacity bounds, description ≤500 if applicable; avoid trusting display-only "Today" text. Handle timezone and DST explicitly. Host ownership must be server-derived.
- State changes must be explicit and validated. Prevent joining DRAFT/CANCELLED/past/non-discoverable activities. When cancelled, do not present attendees as confirmed for an upcoming event. Consider guardrails for events with participants; don't make destructive unapproved reschedules.
- Waitlist promotion after cancellation/leave must be transaction-safe, cannot overbook, rechecks current KYC and eligibility. If an automatic queue behavior remains unspecified, preserve the queue safely and mark promotion policy pending rather than inventing arbitrary priority or deleting data.
- 5xx infra errors remain 5xx; don't convert connection failures to 409 just to satisfy flaky tests. Use standard existing `AppError` envelope.
- Media file and DB updates cannot be fully atomic; use staging/cleanup and document orphans + nonproduction storage.

## 6. Tests: one section-level integration gate later, real unit coverage now

**Execute during implementation:** Prisma validate/generate, TypeScript typecheck, lint, format check, build and focused/unit suite. Implement unit tests for validation, DTO projection, activity state transitions, KYC/visibility decisions, date/time rules, response guards and category/filter parsing.

**Write integration tests now** in the isolated `strangeup_test` harness for:
- Eligible browse without KYC, correct published filters/order/pagination; DRAFT/CANCELLED/hidden access and 401/403/404 boundaries.
- Owner vs other-user drafts/edits/publish/cancel and unauthorized field injection.
- Approved, unverified, expired and revoked KYC hosting and RSVP; virtual-only exemption; no invented approval in production.
- Capacity boundary, concurrent final-seat joins, duplicate join/idempotency, cancellation/rejoin and waitlist consistency/promotion. Failures rollback without partial attendee/capacity state.
- Join/discovery/meeting point blocked in both directions and after privacy/KYC changes. Exact meeting instructions available only to active eligible confirmed users/host; not publicly leaked.
- Location without coordinates or computed distance; safety of filters and response DTO allowlists.
- Image upload security if activity covers are implemented; re-encoded bytes and path ownership.
- Regression of existing Tasks 006–009; database setup guard still blocks wrong database.

**Native PG currently blocked:** `.env` contains `YOUR_PASSWORD` and `prisma migrate deploy` previously failed P1000. Do not ask user to paste credentials, do not disable safeguards, run destructive DB resets or claim integration passed. Record exact DB-gate blockers; enable full migrations + tests when the owner configures private local credentials. Never treat passing unit tests as section integration verification.

## 7. Minimal unified owner-decision/deferral list — do not block all implementation

Create/update a compact decision table only for unresolved *product* rules, after implementing independently safe code:
- Activity category vocabulary vs Profile Interests; which labels are launch options.
- Precise publication, editing and cancellation cutoff (screen mentions 2 hours but this is not an approved rule).
- Waitlist promotion when next queued user lacks current KYC, and public vs confirmed-only attendee roster.
- `FOLLOWERS_ONLY` availability pending Follow graph.
- Activity cover/media storage for production, moderation and retention.
- Public venue display vs sensitive instructions, and any precise map pin / directions policy.
- Any host-and-guest blocking/refund/notification semantics not already approved.

If a rule remains unsettled, deliver useful safe functionality and an explicit not-available/error state. **Do not silently implement irreversible behavior or expose sensitive data.** Do not expand into a series of planning-only tasks.

## 8. Docs + Flutter API handoff (backend-only)

Update `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`, appropriate OpenAPI, `docs/plans/STATUS.md`, `docs/plans/ACTIVE_SCOPE_AND_DEFERRALS.md`, `docs/product/OPEN_QUESTIONS.md` and screen parity mapping. State exactly which endpoints are implemented vs DB-verified, with request/response bodies, envelope, statuses, pagination, access restrictions, KYC-related denial behavior and deferred UI controls. Public and sensitive detail DTOs must be separately documented.

Notify the Flutter developer (via docs only) that Figma demo claims like `100% verified attendees`, maps, distances, member counts/ratings, and two-hour edits cannot be treated as live capability unless grounded by backend behavior and owner policy. Do not edit Flutter repo/code.

## 9. Final report and prohibitions

Report changed files/migrations, exact routes/payloads/auth policies, implemented vs deferred per Screen 11–13, test counts and failures, DB status, risks, owner decisions needed and suggested next Figma section. Keep Tasks 006–008A and 009 **IMPLEMENTED — INTEGRATION PENDING** while native PG credentials block real testing; Task 010 similarly until verified.

**No Flutter repo/code, commits, pushes, production changes, migration rewrites, destructive resets, real KYC provider, Stripe, OAuth, paid ticketing, fake user data, geo/distance, Follow/Wave/Chat, unrelated groups/marketplace/jobs.**

**Implement now; minimize documentation loops and avoid repeated Prisma Dev troubleshooting.**
