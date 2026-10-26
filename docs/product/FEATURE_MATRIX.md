# StrangeUp — Feature Matrix / Proposed Delivery

**Every proposed phase is awaiting owner approval.** `CORE` means recommended minimum, not Figma-verified release scope.

| ID | Module | UI evidence/export | Proposed delivery | Open decision | Engineering guardrail |
|---|---|---|---|---|---|
| FND | Backend foundation | Owner stack fixed; no actual backend yet | CORE | Setup independent of unresolved product behavior | No feature schema in task 001 |
| IDENT | Registration, login, sessions | 31,33,35 | CORE | Email verification, OAuth order, DOB intake, eligibility | Do not invent phone OTP or OAuth requirement beyond visible buttons |
| VERIFY | ID and selfie verification orchestration | 34,48,49 | CORE_ARCHITECTURE / PROVIDER_LATER | Launch region, eligible age, provider and appeal policy | Do not build biometric matching locally |
| PROFILE | Profiles, interests, visibility, media | 03,25,37 | CORE | Visibility levels, field ownership, sensitive DOB exposure | No private contact fields in public profile |
| DISC | Nearby discovery and search | 01,02,47 | CORE | Location precision and mutual-visibility rules | No raw precise coordinates in APIs |
| SOCIAL | Follow, Wave/Hello, connection permissions | 02,03 | CONDITIONAL | Relationship semantics and chat gate | Never assume swipe/matching |
| ACT | Activity discovery, hosting, RSVPs and approvals | 04–07,41 | CORE | Join state model, capacity, waitlist policy | Atomic seat/capacity check |
| GROUP | Groups, member requests, scoped admin | 08,09,43–46 | CORE | Membership state, limits, group privacy, moderation | Owner group authorization |
| FEED | Posts, comments, reactions, shares | 09,46,47 | LIMITED | Feed visibility and content retention | Moderation required |
| STORY | 24-hour community Stories | 46,47 | LATER | Expire vs delete, audience and report policy | TTL/cleanup not yet approved |
| CHAT | Direct and group messaging | 10,11,46 | CORE_DIRECT / GROUP_CONDITIONAL | Consent, message requests, attachments, E2EE claim | Do not call E2EE without validated architecture |
| MEET | Individual meetup invitations | 11,38–40 | CORE | Time-change handshake, expiry, safety check-in | Distinct from group activity booking |
| MEM | Membership and entitlements | 12,42 | CONTRACT_CORE / LIVE_BILLING_LATER | Plan, price, trial, app-store rules | Server verified entitlements |
| STORE | Official gear catalog, cart and orders | 13–15 | LATER | Official-only vs multi-seller; price/discount/tax; fulfillment | No second Club discount accidentally |
| JOBS | Jobs directory, save, apply, track | 23 | LATER | External redirect vs native application, employers | No employer dashboard evidence |
| NOTIF | Notification inbox and dispatch | 36 | CORE | Channels, templates, preferences, dedupe | Authorization for actionable notifications |
| SAFE | Blocking/reporting/privacy/admin | 25,37,41,45 | CORE | Moderation policy, appeals, deletion and retention | Cross-module enforcement |

## MVP recommendation
The first credible release should include moderation/report/block and safe identity/profile lifecycle alongside discovery, basic activity/group workflows and invitation/messaging. Monetization, Stories, Jobs and storefront can be turned on after product and provider rules are decided. This is a recommendation only.

## Tracking states
Use `NOT_ANALYZED`, `REQUIREMENTS_PENDING`, `APPROVED`, `PLANNED`, `IN_PROGRESS`, `IMPLEMENTED`, `TESTED`, `BLOCKED`, `DEFERRED`. Never equate IMPLEMENTED with TESTED.

## Important release warning
Showing a UI tab does not imply its service is safe to expose; disabled feature routes must reject unauthorized/disabled actions server-side.
