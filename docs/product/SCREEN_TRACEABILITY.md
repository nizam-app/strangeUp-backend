# StrangeUp — Screen-to-Backend Traceability

**Evidence:** 39 observed UI screen exports from user-supplied `Strange up.zip`. Original Figma prototype navigation not verified. All implementation implications below are PROPOSED, not approved.

| Export ID | Source PDF | UI feature | Verified actions | Backend implications (PROPOSED) |
|---|---|---|---|---|
| 01 | `Screen 08_ Home Dashboard.pdf` | Home: Initial dashboard | Search, Say Hi, Join Activity, Quick RSVP, See All, Map | Composed home feed aggregations, geofilters, entitlements |
| 02 | `Screen 09_ Discover/Nearby People.pdf` | Discovery: Nearby people | Search, filter, List/Map, View Profile, Say Hi/Wave | Geo/privacy-aware search, last-active, wave or connection state |
| 03 | `Screen 10_ User Profile.pdf` | Discovery: Public user profile | Follow, Message, wave, activity/group links | Profile visibility; follow records, approved social actions, aggregate metrics |
| 04 | `Screen 11_ Activity Discovery.pdf` | Activities: Activity discovery | Search, filter, List/Map, Join Activity | Activity list, capacity query, nearby search, eligibility |
| 05 | `Screen 12_ Activity Details.pdf` | Activities: Activity details | Directions, See All, Join Activity | Activity detail read, join transaction, eligibility, privacy-sensitive venue details |
| 06 | `Html → Body.pdf` | Activities: My activities | View Activity, Message Group, Leave Activity, Manage, Cancel Request | Per-user registration/hosting state; cancellation and message access |
| 07 | `Screen 13_ Create Activity.pdf` | Activities: Create activity | Change Photo, select category, waitlist toggle, Publish Activity | Host ownership, media, schedule, capacity/waitlist, geo privacy, visibility |
| 08 | `Screen 14_ Groups.pdf` | Groups: Group discovery | Create, Search, Join Group, See All | Group directory, discovery ranking, memberships, join policy |
| 09 | `Screen 15_ Group Details/Community.pdf` | Groups: Original group details | Like, Comment, Share, RSVP, Create Post | Group posts/reactions/comments, event reference, permissions |
| 10 | `Screen 16_ Messages/Chat List.pdf` | Messaging: Conversation list | Search, New Chat, Recent, Requests, open chat | Conversations, participants, chat request gating, unread counts and presence |
| 11 | `Screen 17_ Chat Conversation.pdf` | Messaging: Conversation detail | Send message, Plan Meetup, Photo, Accept, Decline | Message persistence + sockets, permission gates, attachment uploads; E2EE claim requires review |
| 12 | `Screen 18_ Membership Plans.pdf` | Membership: Membership plans | Switch monthly/yearly, Upgrade to Premium | Entitlement definitions, plan/pricing catalog, trial status and eligibility |
| 13 | `Screen 20_ Marketplace.pdf` | Commerce: Marketplace catalog | Search, filter, product selection, add to bag | Catalog/product variants, price engine, cart, membership perk eligibility |
| 14 | `Screen 21_ Product Details.pdf` | Commerce: Product details | Select variant, qty, Add to Cart, Buy Now | Variant inventory, stock reservation, pricing, fulfillment methods |
| 15 | `Screen 22_ Cart & Checkout.pdf` | Commerce: Cart and checkout | Quantity update, pickup/delivery selection, Place Order | Cart/order/payment states, idempotent checkout, tax/discount fix, pickup QR handover |
| 23 | `Screen 23_ Jobs.pdf` | Jobs: Job directory | Save, Apply Now, Track, filter | Job listings and applications; employer management/external application model not shown |
| 25 | `Screen 26_ Profile & Settings.pdf` | Settings: Account & settings | Edit Profile, Security, Subscriptions, Blocked Users, Delete Account | Account lifecycle, user settings, billing visibility, access requests and deletion |
| 27 | `Screen 1_ Splash Screen.pdf` | Onboarding: Splash | Launch; no direct persistent mutation identified | Presentation/static; remote counts not authenticated |
| 28 | `Screen 3_ Onboarding - Safe & Verified Community.pdf` | Onboarding: Safety onboarding | Continue, Skip | Verification gating and policy decisions |
| 29 | `Screen 2_ Onboarding - Meet People Around You.pdf` | Onboarding: Nearby onboarding | Continue, Skip | Location permission/discovery explanations; no location sharing assumed |
| 30 | `Screen 4_ Onboarding - Meet Through Activities.pdf` | Onboarding: Activities onboarding | Get Started, Login, Skip | No backend beyond onboarding status unless product requires it |
| 31 | `Screen 05_ Login.pdf` | Identity: Login | Log In, Continue with Apple, Continue with Google, Sign Up | Sessions, OAuth account linking, password credentials, rate limits |
| 33 | `Screen 06_ Sign Up.pdf` | Identity: Sign up | Create Account, Log In | User + credential, consent evidence, email/phone validation |
| 34 | `Screen 07_ ID Verification.pdf` | Identity: Verification status | Start Verification | VerificationSession, state transitions and provider callbacks |
| 35 | `Html → Body → Main - Native Mobile App Canvas (393px iPhone 15 base).pdf` | Identity: Forgot password | Send Reset Link, Log In | One-time expiring reset challenge; safe anti-enumeration responses |
| 36 | `Html → Notification.pdf` | Notifications: Notification center | Mark all read, Accept/Decline, View Group, filters | Typed notifications, read state, deep links, side-effect deduplication |
| 37 | `Html → Body-1.pdf` | Settings: Edit profile | Save, Discard, photo change/remove, visibility choices | Profile update, photo storage, field validation, privacy enforcement |
| 38 | `Html → Body → iPhone 15 frame simulation (393px width, 852px height).pdf` | Meetups: Create personal meetup | Send Meetup Invite | Direct MeetupInvite entity, sender/recipient visibility and time zone handling |
| 39 | `Html → Body-2.pdf` | Meetups: Meetup invitations inbox | Accept, View Details, filters | Inbox, responses, expiry, idempotent transitions |
| 40 | `Html → Body-3.pdf` | Meetups: Meetup invitation details | Accept Meetup, Reschedule, Decline, Directions | Invite state workflow; check-in prompts and privacy decisions |
| 41 | `Html → Body-4.pdf` | Activities: Join request moderation | Approve, Profile, Message David | JoinRequest state machine, capacity race-safety, notifications, audit |
| 42 | `Html → Body-5.pdf` | Membership: Subscription checkout | Change plan, select card, Start Free Trial, Restore Purchases | Platform-policy review: IAP vs card, receipt verification, subscription lifecycle |
| 43 | `Html → Body-6.pdf` | Groups: My groups | Open Group, Members, Manage Group, Invite, Cancel request | Membership ownership/invitations/join approvals |
| 44 | `Screen 1_ Create Group.pdf` | Groups: Create group | Upload, choose settings, Create Group | Group settings, membership eligibility, location and cap enforcement |
| 45 | `Screen 2_ Manage Group Dashboard.pdf` | Groups: Manage group | Edit Group, Join Requests, Create Post, Review | Group role authorization, moderation, audit, membership request actions |
| 46 | `Screen 15_ Group Details — Stories, Chat & Meetups Update.pdf` | Groups: Updated group details | Post, Photo, Activity, Poll, Stories, Chat, Meetups, RSVP | Group Story TTL, group chat, polls, linked meetups; revision likely supersedes #09 |
| 47 | `Screen 08_ Home Dashboard — Community & Stories Update.pdf` | Home: Updated dashboard | Your Story, Open Group, Connect, Join Meetup, Share, filter feed | Stories expiry, group activity feed and home aggregate; revision overlay |
| 48 | `Screen 1 — Government ID Verification.pdf` | Identity: Government ID upload | Select ID type, upload/retake, continue to selfie | Secure PII upload/provider session; retention and access rules unresolved |
| 49 | `Screen 2 — Selfie Verification.pdf` | Identity: Selfie verification | Continue to Final Review | Liveness workflow orchestration; no local face recognition assumption |

## Notes
- Export #01 and #47 are old/updated Home variants; #09 and #46 are old/updated Group Details variants. Which takes precedence is UNRESOLVED.
- Non-UI auxiliary exports (eight Mask groups, one Container, one active Jobs-tab label) are not counted as screens.
- This export set does not prove the original Figma document has only 39 screens or that UI buttons are wired.
- UX content often uses mock dates/counts; never hardcode them into seed/production.
