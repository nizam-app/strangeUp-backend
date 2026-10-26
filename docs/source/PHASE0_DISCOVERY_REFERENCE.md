# StrangeUp — Phase 0 Product Discovery & Backend Requirements

**Evidence source:** user-supplied `Strange up.zip`, containing 49 PDF exports. **Review:** extracted embedded PDF text and rendered all 49 PDFs for visual screen inspection. **Source limitation:** not an inspection of live Figma page hierarchy, linked prototype interactions, source components or annotations. No Figma source was modified.

**Label key:** **OBSERVED** = visible in exported screens; **PROPOSED** = engineering recommendation, not an approved behavior; **UNRESOLVED** = needs product decision. All endpoint/entity naming below is PROPOSED.

## A. Verified exported-screen inventory

**49 PDF exports = 39 meaningful app UI screens/variants + 10 auxiliary exports** (eight `Mask group` labels, one `Link - Tab 4_ Jobs (ACTIVE)`, one `Container`). Every PDF contains one page. Updated variants coexist with older versions; they are not additive evidence for two independent screens.

| Export | PDF | Area / screen | OBSERVED purpose & visible actions | PROPOSED backend implications |
|---|---|---|---|---|
| 01 | `Screen 08_ Home Dashboard.pdf` | **Home: Initial dashboard** | Current city, active peers, nearby users/activities, curated meetup and navigation; **actions:** Search, Say Hi, Join Activity, Quick RSVP, See All, Map | Composed home feed aggregations, geofilters, entitlements |
| 02 | `Screen 09_ Discover/Nearby People.pdf` | **Discovery: Nearby people** | List/map, radius, today/activity/age/verified filters, profile cards; **actions:** Search, filter, List/Map, View Profile, Say Hi/Wave | Geo/privacy-aware search, last-active, wave or connection state |
| 03 | `Screen 10_ User Profile.pdf` | **Discovery: Public user profile** | Follow/message, bio/interests, followers, ratings, activities, community groups; **actions:** Follow, Message, wave, activity/group links | Profile visibility; follow records, approved social actions, aggregate metrics |
| 04 | `Screen 11_ Activity Discovery.pdf` | **Activities: Activity discovery** | Activity category filter, list/map, spot counts, host and location; **actions:** Search, filter, List/Map, Join Activity | Activity list, capacity query, nearby search, eligibility |
| 05 | `Screen 12_ Activity Details.pdf` | **Activities: Activity details** | Description, schedule, venue, safety requirements, attendees, host and reviews; **actions:** Directions, See All, Join Activity | Activity detail read, join transaction, eligibility, privacy-sensitive venue details |
| 06 | `Html → Body.pdf` | **Activities: My activities** | Upcoming, hosting, joined and pending activities, leave and group chat; **actions:** View Activity, Message Group, Leave Activity, Manage, Cancel Request | Per-user registration/hosting state; cancellation and message access |
| 07 | `Screen 13_ Create Activity.pdf` | **Activities: Create activity** | Cover, category, description, dates, timezone-sensitive schedule, venue/pin, capacity, waitlist, verified-only, audience; **actions:** Change Photo, select category, waitlist toggle, Publish Activity | Host ownership, media, schedule, capacity/waitlist, geo privacy, visibility |
| 08 | `Screen 14_ Groups.pdf` | **Groups: Group discovery** | My groups, discover groups by category/tag/location; verification labels; **actions:** Create, Search, Join Group, See All | Group directory, discovery ranking, memberships, join policy |
| 09 | `Screen 15_ Group Details/Community.pdf` | **Groups: Original group details** | Posts/Members/About, pinned post, reactions, comments, linked activity RSVP; **actions:** Like, Comment, Share, RSVP, Create Post | Group posts/reactions/comments, event reference, permissions |
| 10 | `Screen 16_ Messages/Chat List.pdf` | **Messaging: Conversation list** | Individual and group chats, active circles, unread badges, recent/requests tabs; **actions:** Search, New Chat, Recent, Requests, open chat | Conversations, participants, chat request gating, unread counts and presence |
| 11 | `Screen 17_ Chat Conversation.pdf` | **Messaging: Conversation detail** | Direct chat, linked activity, typing/read/delivered, venue invite card, photo and meetup controls; **actions:** Send message, Plan Meetup, Photo, Accept, Decline | Message persistence + sockets, permission gates, attachment uploads; E2EE claim requires review |
| 12 | `Screen 18_ Membership Plans.pdf` | **Membership: Membership plans** | Basic Explorer free vs Strangeup Club; monthly/yearly; perks; 7-day trial; **actions:** Switch monthly/yearly, Upgrade to Premium | Entitlement definitions, plan/pricing catalog, trial status and eligibility |
| 13 | `Screen 20_ Marketplace.pdf` | **Commerce: Marketplace catalog** | Official/community merchandise, filtered gear, member prices, meetup pickup; **actions:** Search, filter, product selection, add to bag | Catalog/product variants, price engine, cart, membership perk eligibility |
| 14 | `Screen 21_ Product Details.pdf` | **Commerce: Product details** | Size/color variants, reviews, stock, meetup pickup vs shipping, quantity; **actions:** Select variant, qty, Add to Cart, Buy Now | Variant inventory, stock reservation, pricing, fulfillment methods |
| 15 | `Screen 22_ Cart & Checkout.pdf` | **Commerce: Cart and checkout** | Two line items, Club prices, discount line, delivery choice, saved card, tax, QR pickup; **actions:** Quantity update, pickup/delivery selection, Place Order | Cart/order/payment states, idempotent checkout, tax/discount fix, pickup QR handover |
| 23 | `Screen 23_ Jobs.pdf` | **Jobs: Job directory** | Search, filters, featured jobs, saved count, application count, under-review status; **actions:** Save, Apply Now, Track, filter | Job listings and applications; employer management/external application model not shown |
| 25 | `Screen 26_ Profile & Settings.pdf` | **Settings: Account & settings** | Public profile, password/2FA, activities/groups/invites/jobs, billing, blocked users, privacy, deletion; **actions:** Edit Profile, Security, Subscriptions, Blocked Users, Delete Account | Account lifecycle, user settings, billing visibility, access requests and deletion |
| 27 | `Screen 1_ Splash Screen.pdf` | **Onboarding: Splash** | Brand logo, nearby verified peers teaser, community safety messaging; **actions:** Launch; no direct persistent mutation identified | Presentation/static; remote counts not authenticated |
| 28 | `Screen 3_ Onboarding - Safe & Verified Community.pdf` | **Onboarding: Safety onboarding** | Verified network, government ID review, safety claims; **actions:** Continue, Skip | Verification gating and policy decisions |
| 29 | `Screen 2_ Onboarding - Meet People Around You.pdf` | **Onboarding: Nearby onboarding** | Location-centric nearby people and activities; precise sharing qualifier; **actions:** Continue, Skip | Location permission/discovery explanations; no location sharing assumed |
| 30 | `Screen 4_ Onboarding - Meet Through Activities.pdf` | **Onboarding: Activities onboarding** | Shared interests and community activities; **actions:** Get Started, Login, Skip | No backend beyond onboarding status unless product requires it |
| 31 | `Screen 05_ Login.pdf` | **Identity: Login** | Email+password; Apple and Google login; forgot password; **actions:** Log In, Continue with Apple, Continue with Google, Sign Up | Sessions, OAuth account linking, password credentials, rate limits |
| 33 | `Screen 06_ Sign Up.pdf` | **Identity: Sign up** | First and last names, email, phone, password, confirm password, terms; **actions:** Create Account, Log In | User + credential, consent evidence, email/phone validation |
| 34 | `Screen 07_ ID Verification.pdf` | **Identity: Verification status** | Steps: Personal Information, Government ID, Selfie Verification, Review; **actions:** Start Verification | VerificationSession, state transitions and provider callbacks |
| 35 | `Html → Body → Main - Native Mobile App Canvas (393px iPhone 15 base).pdf` | **Identity: Forgot password** | Email-based reset link; **actions:** Send Reset Link, Log In | One-time expiring reset challenge; safe anti-enumeration responses |
| 36 | `Html → Notification.pdf` | **Notifications: Notification center** | Meetup invites, approvals, messages, memberships, verification, groups and events; **actions:** Mark all read, Accept/Decline, View Group, filters | Typed notifications, read state, deep links, side-effect deduplication |
| 37 | `Html → Body-1.pdf` | **Settings: Edit profile** | Name/username, DOB, location, bio, interest tags, favorite activities, visibility, image actions; **actions:** Save, Discard, photo change/remove, visibility choices | Profile update, photo storage, field validation, privacy enforcement |
| 38 | `Html → Body → iPhone 15 frame simulation (393px width, 852px height).pdf` | **Meetups: Create personal meetup** | Recipient, category, title, date/time, location, optional note; **actions:** Send Meetup Invite | Direct MeetupInvite entity, sender/recipient visibility and time zone handling |
| 39 | `Html → Body-2.pdf` | **Meetups: Meetup invitations inbox** | Pending/all/accepted/declined invitations, sender, location, note; **actions:** Accept, View Details, filters | Inbox, responses, expiry, idempotent transitions |
| 40 | `Html → Body-3.pdf` | **Meetups: Meetup invitation details** | Meeting spot/map, notes, mutual count, safety check-in guidance; **actions:** Accept Meetup, Reschedule, Decline, Directions | Invite state workflow; check-in prompts and privacy decisions |
| 41 | `Html → Body-4.pdf` | **Activities: Join request moderation** | Host approvals, declined/pending/approved requests, trust and capacity; **actions:** Approve, Profile, Message David | JoinRequest state machine, capacity race-safety, notifications, audit |
| 42 | `Html → Body-5.pdf` | **Membership: Subscription checkout** | Monthly Club price $9.99, trial, tax, card entry, restore purchases; **actions:** Change plan, select card, Start Free Trial, Restore Purchases | Platform-policy review: IAP vs card, receipt verification, subscription lifecycle |
| 43 | `Html → Body-6.pdf` | **Groups: My groups** | Joined/managed/pending groups, group posts/activity, pending approval; **actions:** Open Group, Members, Manage Group, Invite, Cancel request | Membership ownership/invitations/join approvals |
| 44 | `Screen 1_ Create Group.pdf` | **Groups: Create group** | Image, name (60), category, base location, description, tags, public/private, frequency and member cap; **actions:** Upload, choose settings, Create Group | Group settings, membership eligibility, location and cap enforcement |
| 45 | `Screen 2_ Manage Group Dashboard.pdf` | **Groups: Manage group** | Admin console, pending join requests, member count, new posts, quick actions and activity log; **actions:** Edit Group, Join Requests, Create Post, Review | Group role authorization, moderation, audit, membership request actions |
| 46 | `Screen 15_ Group Details — Stories, Chat & Meetups Update.pdf` | **Groups: Updated group details** | Adds Stories, Chat, Meetups tabs, composer actions Photo/Activity/Poll; **actions:** Post, Photo, Activity, Poll, Stories, Chat, Meetups, RSVP | Group Story TTL, group chat, polls, linked meetups; revision likely supersedes #09 |
| 47 | `Screen 08_ Home Dashboard — Community & Stories Update.pdf` | **Home: Updated dashboard** | Community stories (24h), groups, group feed, nearby people and activities; **actions:** Your Story, Open Group, Connect, Join Meetup, Share, filter feed | Stories expiry, group activity feed and home aggregate; revision overlay |
| 48 | `Screen 1 — Government ID Verification.pdf` | **Identity: Government ID upload** | Passport, driver license, national ID, preview ID image, retake; **actions:** Select ID type, upload/retake, continue to selfie | Secure PII upload/provider session; retention and access rules unresolved |
| 49 | `Screen 2 — Selfie Verification.pdf` | **Identity: Selfie verification** | Facial liveness positioning guide; **actions:** Continue to Final Review | Liveness workflow orchestration; no local face recognition assumption |

### Auxiliary exports (not application screens)

- `Mask group.pdf` (export 16): non-screen label, tiny asset, or navigation artifact; not counted as a standalone UI screen.

- `Mask group-1.pdf` (export 17): non-screen label, tiny asset, or navigation artifact; not counted as a standalone UI screen.

- `Mask group-2.pdf` (export 18): non-screen label, tiny asset, or navigation artifact; not counted as a standalone UI screen.

- `Mask group-3.pdf` (export 19): non-screen label, tiny asset, or navigation artifact; not counted as a standalone UI screen.

- `Mask group-4.pdf` (export 20): non-screen label, tiny asset, or navigation artifact; not counted as a standalone UI screen.

- `Mask group-5.pdf` (export 21): non-screen label, tiny asset, or navigation artifact; not counted as a standalone UI screen.

- `Mask group-6.pdf` (export 22): non-screen label, tiny asset, or navigation artifact; not counted as a standalone UI screen.

- `Link - Tab 4_ Jobs (ACTIVE).pdf` (export 24): non-screen label, tiny asset, or navigation artifact; not counted as a standalone UI screen.

- `Container.pdf` (export 26): non-screen label, tiny asset, or navigation artifact; not counted as a standalone UI screen.

- `Mask group-7.pdf` (export 32): non-screen label, tiny asset, or navigation artifact; not counted as a standalone UI screen.

## B. Confirmed visible user journeys (screen sequence inferred, not prototype-verified)

- **New-user acquisition** (27,29,28,30,33,34,48,49): Splash → Onboarding nearby → verified safety → activities → Sign up → verification stepper → ID document → selfie → final review (final review screen missing).

- **Returning login** (31,35): Login with email/password or Apple/Google; password reset via email.

- **Nearby social discovery** (01/47,02,03,10–11): Dashboard → Nearby people list/map → public profile → follow / wave / message. Message eligibility not defined.

- **Activities** (01/47,04–07,41): Home/activity discovery → Activity detail → join or request → joined list; host may approve; cancellation and waitlisting are shown but not fully represented.

- **Group/community** (08–09,43–46): Groups discovery → public join or private request → group content/members; admins create/manage communities and requests; updates add Stories/Chat/Meetups.

- **Personal meetup** (11,38–40): Chat → Plan Meetup → Send Invite → recipient inbox → invitation details → accept/decline/reschedule.

- **Messaging** (10,11): Messages list → direct/group thread → text, photo, typing, read state, venue card and meetup actions.

- **Membership** (12,42,25): Plan comparison → upgrade → monthly checkout/trial → account subscription/payment history. Annual plan visual exists too, purchase state ambiguous.

- **Community store** (13–15): Catalog → product variant → cart → choose meetup pickup/shipping → pay → QR confirmation suggested, post-payment screen absent.

- **Jobs** (23): Find a job → apply; saved/applications counters; tracking stub, application details absent.

- **Account safety** (25,37,34): Settings → edit personal/profile details, passwords/2FA, manage blocks, identity verification, subscription, account deletion.

## C. Screen coverage versus complete-product implementation

| Workflow | What is covered by UI export | Missing / uncertain screen or behavior |
|---|---|---|
| Auth | login/sign-up, social buttons, forgot-password screen | Email/phone verification, OAuth failure/link, reset success, account locked/recovery, signup DOB mismatch |
| Identity | stepper, ID type/upload, selfie screen | Provider handoff, review result, reject/retry/appeal, verification expiry and consent |
| Discovery | nearby people, map toggle, age/radius/verification filters | Map interactive behavior, privacy opt-outs, filter save/persistence, wave request behavior |
| Profiles | public user profile, edit profile | Follow requests, profile report/block control, private-profile fallback, visibility rules |
| Activities | discover/detail/create/my activities/request approvals | Payment/premium gating, edit/reschedule/cancel flow, waitlist entry/promotion, attendance/check-in, host review action |
| Groups | discover/detail, create/manage, member requests; stories/chat/meetups tabs | Stories composer/detail and expiry UI, group chat detail, polls creation/participation, role assignment, invites |
| Chat | list/detail and message request tabs | New conversation start, attachments workflow, delivery failure, blocking, media moderation |
| Personal meetups | create/inbox/details | Reschedule modal/acceptance, cancellation, invitation expiration, check-in action |
| Membership | plans and trial checkout | Plan lifecycle, successful/failed purchase, renewal, restore result, cancellation, tax or family sharing rules |
| Commerce | catalog/details/cart checkout | Address form, purchase success/failure, order history, return/refund, QR pickup scan, staff fulfillment |
| Jobs | directory | Job detail, application form, saved jobs detail, employer job posting, moderation |
| Notifications | list with inline actions and read state | User preferences, push opt-ins, pagination and deep links |
| Platform moderation | Group admin & blocked users mentioned | Admin console, reports/appeals, moderation queue, suspension and audit tools |

## D. Candidate backend modules and data model (PROPOSED; not schema approval)

- **Identity and safety** — OBSERVED: Email/password login, Apple/Google sign in, government ID/selfie. PROPOSED entities: `Credential, OAuthIdentity, Session, VerificationSession`. UNRESOLVED: Decide auth entry, verification gating, eligibility, provider.

- **Profiles and privacy** — OBSERVED: Public profile, interests, followers, verified badge, visibility modes. PROPOSED entities: `User, Profile, Interest, ProfileInterest, Follow, PrivacySetting`. UNRESOLVED: DOB, access conditions, profile exposure and location precision.

- **Discovery** — OBSERVED: Nearby people with list/map filters and wave/hello. PROPOSED entities: `DiscoveryFilter (optional), Wave, Connection`. UNRESOLVED: Clarify follow vs wave vs chat permissions; geo coarsening.

- **Activities** — OBSERVED: Activity listing/creation, join, capacity, host approval, waitlist. PROPOSED entities: `Activity, ActivityParticipant, ActivityJoinRequest, WaitlistEntry`. UNRESOLVED: Paid participation? cancellations and overbooking rules.

- **Communities** — OBSERVED: Public/private groups, member admin, join approvals, posts. PROPOSED entities: `Group, GroupMembership, GroupJoinRequest, GroupPost`. UNRESOLVED: Group roles, membership invitation state, owner transfer.

- **Stories** — OBSERVED: 24h community stories in updated Home and group details. PROPOSED entities: `Story, StoryMedia, StoryView (optional)`. UNRESOLVED: Story author, eligibility, retention and moderation.

- **Chat** — OBSERVED: 1:1 and group chat, request inbox, attachments, read/delivered. PROPOSED entities: `Conversation, ConversationParticipant, Message, MessageReceipt`. UNRESOLVED: E2EE claim, chat permissions, retention and attachments.

- **Personal meetup invites** — OBSERVED: Create, receive, accept, reschedule, decline invite. PROPOSED entities: `MeetupInvite, InviteResponse, CheckIn`. UNRESOLVED: Eligibility, scheduling states, check-in semantics.

- **Membership** — OBSERVED: Free vs Club plan, trials, renewal, benefits. PROPOSED entities: `MembershipPlan, Subscription, Entitlement, PurchaseRecord`. UNRESOLVED: Finalize tiers, prices, trial and mobile purchase mechanism.

- **Official merchandise** — OBSERVED: Product variants, cart, shipping/meetup pickup, member prices. PROPOSED entities: `Product, SKU, Inventory, Cart, Order, OrderItem, Pickup`. UNRESOLVED: No evidence of peer sellers; fix double discount, delivery and QR flow.

- **Jobs** — OBSERVED: Search/save/apply/track community jobs. PROPOSED entities: `Job, SavedJob, JobApplication`. UNRESOLVED: Native vs external applications; employer dashboard missing.

- **Notifications** — OBSERVED: In-app activity/group/message/payment alerts and read state. PROPOSED entities: `Notification, DeviceToken, NotificationPreference`. UNRESOLVED: Channels and triggers, action delivery dedupe.

- **Admin and moderation** — OBSERVED: User block settings, group host console, support entry. PROPOSED entities: `Report, Block, ModerationCase, AuditEvent`. UNRESOLVED: No central platform admin console provided; define operational MVP.

### Relationship and consistency rules to design before implementation

- `User` owns `Profile`, sessions and verification status. Keep public profile DTOs separate from private contact/identity data.

- `GroupMembership` connects users/groups, with scoped role and request state; group moderation actions require resource ownership authorization.

- `ActivityParticipant` must prevent duplicate active RSVPs and over-capacity bookings, using transaction/concurrency design; waits/approval states are separate from confirmed seats.

- Personal one-to-one `MeetupInvite` differs from group `Activity`; do not force both into one entity without proving common state semantics.

- `ConversationParticipant` determines message reads/writes; authorizing by conversation ID alone is not sufficient. Group chat and direct chat can share transport but have distinct membership rules.

- `Subscription` and `Entitlement` are distinct; a successful payment event must not be treated as permanent access. All membership gates must be server-enforced.

- Product `SKU` includes size/color variants and stock; orders capture an immutable pricing snapshot, fees, and selected fulfillment. Sensitive payment card data must remain with payment providers.

- All relevant account Blocks and suspension actions should apply across discovery, messaging, invitations, group requests and activities consistently.

- Store timestamps as UTC instants with separately recorded scheduling time zones; use privacy-preserving approximate discovery location where possible.

## E. Potential API surface (PROPOSED; not contracts)

- **Auth:** `POST /v1/auth/register, /login, /oauth/{provider}, /refresh, /forgot-password, /reset-password`

- **Trust:** `POST /v1/verification/sessions; GET /v1/verification/status; webhook callbacks after provider selection`

- **Profiles:** `GET/PATCH /v1/me/profile; GET /v1/users/{id}; POST /v1/users/{id}/follow or /wave (subject to behavior confirmation)`

- **Discovery:** `GET /v1/discovery/people?radius&interest&age&verified; GET /v1/discovery/home`

- **Activity:** `GET/POST /v1/activities; GET/PATCH /v1/activities/{id}; POST/DELETE /v1/activities/{id}/registrations; POST /v1/activities/{id}/join-requests/{id}/approve`

- **Groups:** `GET/POST /v1/groups; GET /v1/groups/{id}; POST /v1/groups/{id}/join; POST /v1/groups/{id}/posts; POST /v1/groups/{id}/stories`

- **Chat:** `GET/POST /v1/conversations; GET/POST /v1/conversations/{id}/messages; authenticated realtime events`

- **Meetups:** `POST /v1/meetup-invites; GET /v1/meetup-invites; POST /v1/meetup-invites/{id}/accept|decline|reschedule`

- **Membership:** `GET /v1/membership/plans and /entitlements; purchase verification and store subscription webhook; GET /v1/membership/history`

- **Commerce:** `GET /v1/store/products; POST /v1/cart/items; POST /v1/orders/checkout; GET /v1/orders/{id}`

- **Jobs:** `GET /v1/jobs; POST /v1/jobs/{id}/save; POST /v1/jobs/{id}/applications`

- **Operations:** `GET /v1/notifications; PATCH /v1/notifications/read; POST /v1/reports; POST /v1/blocks; protected admin moderation routes`

## F. High-priority contradictions and risks

| Priority | OBSERVED discrepancy/risk | Files | Required decision/action |
|---|---|---|---|
| P0 | Plan screen selects yearly Club at $6.49/month (billed $77.88/year) while checkout presents monthly $9.99/month; these can be legitimate different billing periods, but plan selection handoff must be explicit. Checkout also shows $9.99 + $0.80 tax - $9.99 trial credit = $0 due, which needs a clear tax treatment. | 12 vs 42 | Confirm selected-plan handoff, annual/monthly catalog, whether trial tax is deferred/waived, and correct charge summary. |
| P0 | Cart shows already-discounted Club prices $71.40 and $28.90 but applies another $15 Club discount to $100.30 subtotal. | 13,14 vs 15 | Define whether catalog member prices or cart-level discount wins; prevent double discount. |
| P0 | Sign up collects name/email/phone/password; verification stepper asserts Personal Information completed during sign-up. DOB appears only in edit-profile screen. | 33,34,37 | Resolve DOB/age eligibility, signup personal data and provider verification requirements. |
| P0 | UI uses "End-to-End Encrypted" and "100% ID verified" safety claims; no cryptographic protocol or actual verification policy is specified. | 11,27,28,31,33 | Treat text as UI copy, not implemented security guarantees; settle truthful claims before release. |
| P0 | Subscription checkout collects card/CVV inside mobile design, whereas mobile digital subscription checkout may need app-store purchases. | 42 | Verify current Apple/Google policy for planned regions; choose permitted store/in-app flow. |
| P1 | Old and updated versions of Home and Group Detail coexist; later versions add Stories/Chat/Meetups. | 01 vs 47; 09 vs 46 | Declare authoritative version and preserve missing earlier features where desired. |
| P1 | Activity detail shows 12/16 for Sunset Ride, whereas host join-requests screen shows 6/10 for same named activity. | 05 vs 41 | Mock content inconsistency; never infer actual booking count/capacity from visual fixtures. |
| P1 | Jobs module has application action and status but no application details, recruiter or employer management flow. | 23 | Decide external job URLs vs full applications and employer operations; phase appropriately. |
| P1 | Store presents official gear, not peer-to-peer seller listings. Original product concept mentions small marketplace. | 13–15 | Choose official merchandise store vs user-to-user marketplace before seller/payment architecture. |
| P1 | Personal Meetup and Activity use overlapping terms yet different invitation, hosting, approval and attendance states. | 04–07,38–41 | Define distinct types and transition diagrams to avoid accidental conflation. |
| P1 | Nearby distance, last-active state, public venue and upcoming activities may expose sensitive location/activity data. | 02,03,05,40 | Define defaults, approximate location, recipient-specific venue exposure and safety controls. |
| P2 | Figma content mixes sample dates from 2024 and 2025, and some labels have text overflow/typos. | 06,07,25,39–40 | Treat as static mock data; avoid hardcoding and request refined product copy before launch. |

## G. Recommended build path and scope control

**Recommended architecture:** Confirmed Node.js + TypeScript + Express + Prisma + PostgreSQL, implemented as a modular monolith; adopt Redis/Socket.IO/background queues/object storage only when actual agreed flows justify their use. No backend code has been generated, tested or deployed during this review.

### Phase 0 completion prerequisites

1. Approve authoritative Home/Group Detail variants and product navigation.

2. Confirm verified-user gating, age eligibility, social actions (Follow/Wave/Message), location exposure and block policies.

3. Approve activity registration state machine, group membership roles and individual meetup invitation state machine.

4. Fix subscription pricing, mobile purchase policy and membership entitlement matrix.

5. Resolve store type (official inventory vs peer sellers), pricing/taxes, fulfillment and pickup responsibilities.

6. Decide whether Jobs and 24-hour Stories belong in the first MVP; approve missing screen/flow backlog.

### Milestone candidates

- **M0 Discovery and PRD:** consolidate screen-to-requirement mapping, user journeys, state machines, safety/commerce decisions; approve MVP.

- **M1 Foundation:** repo setup, TS/Express, Prisma/Postgres, config/secrets, API spec/error conventions, migrations, test runner, CI rules, docs.

- **M2 Trust and identity:** registration/social login, sessions, user profile privacy, verification provider orchestration, block/report core, authorization tests.

- **M3 Discover/activities/groups:** nearby profiles with privacy, activity join/capacity, group membership, host moderation, integrated tests.

- **M4 Messaging/meetups:** direct/group chat, realtime delivery, permission checks, personal meetup invitations, notification outbox if warranted.

- **M5 Paid/expansion:** entitlement gates/subscription lifecycle, official store, Jobs and Stories (pending scope approval).

- **M6 Administration and hardening:** moderation, service observability, backups, retention/deletion, deployment and production readiness.

## H. Read-only coverage boundary

- **Verified:** 49 actual PDF documents exist; 39 have meaningful UI; visible copy/buttons/layouts have been extracted and visually reviewed. File names and export index are available in companion CSV.

- **Not verified:** page names in source Figma, prototype links, hover/interaction states, component variants, redlines, original design tokens, screen precedence, workflow backend behavior, app store compliance, product legal/regional requirements, or any existing implementation.

- **No Figma mutations:** The original design was neither modified nor accessed through write tools. All discovered facts originate in the ZIP export, not a live Figma connector read.

**Decision discipline:** Visual screens are references, not approved policies. Proposed models/endpoints here are planning candidates only.
