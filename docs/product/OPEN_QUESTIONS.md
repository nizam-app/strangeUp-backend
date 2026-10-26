# Open Product Decisions — Owner Review Queue

**State:** all items OPEN. Each proposed default is explicitly non-approved. Do NOT block foundation scaffolding on these choices; DO block affected feature logic and production payment/verification integrations.

| ID | Priority | Decision required | Recommended temporary handling | Blocks |
|---|---|---|---|---|
| D-01 | P0 | Launch jurisdictions, minimum age, eligibility and prohibited users | Propose adults-only; gate identity rollout until region confirmed | KYC, moderation, billing, legal policies |
| D-02 | P0 | Signup DOB/consent collection and verification gates | Separate user account status from verification status, do not grant verified rights early | signup, verification, discovery |
| D-03 | P0 | Who can see, follow, wave and message whom? | Deny any unapproved contact action until approved policy | discovery, chat, invites |
| D-04 | P0 | Exact location privacy: list/map, venue, active status | Approximate outward location and no default exact coordinates | discovery, activity, personal meetups |
| D-05 | P0 | Activity join: automatic/approval/waitlist/cancel/paid or free | Proposed finite state machine, refuse over-capacity | activities, host tools |
| D-06 | P0 | Group membership policy and permissions | Proposed scoped owner/mod/member roles; private groups require approval | groups, group chat/content |
| D-07 | P0 | Meetup eligibility, expiration, rescheduling and check-in | Proposed explicit mutual reschedule and time-zone preservation | invitations, notifications |
| D-08 | P0 | Digital Club entitlements, trial, pricing and platform payment by region | Billing adapter contract only; do not activate live billing | membership and premium gates |
| D-09 | P0 | Verification/KYC provider, liveness, personal data retention and appeals | Provider-neutral state contract; do not store raw identity docs in DB | verification, safety claim |
| D-10 | P0 | E2EE messaging marketing claim and security architecture | No E2EE claim; secure transport/storage only as documented | chat, marketing copy |
| D-11 | P1 | Is marketplace official merchandise or third-party user seller marketplace? | Assume neither until approved; model official SKU only as candidate | store, seller model |
| D-12 | P1 | Merchandise member discount, tax, trial total and refunds | Implement zero production checkout until price rules approved | orders/payment |
| D-13 | P1 | Priority: jobs and Stories in initial MVP or later? | Recommend later / feature-flagged | scope, roadmap |
| D-14 | P1 | Updated Home #47 / Group #46 authoritative versions? | Use for impact analysis only pending approval | navigation, product spec |
| D-15 | P1 | What counts as reportable abuse, response time, suspension/appeals? | Build generic report/block admin core, finalize policy | trust/safety |
| D-16 | P1 | Who publishes jobs, native apply or external link? | Keep module deferred | jobs |
| D-17 | P1 | Admin panel expectations and staffing for moderation/pickup | Build minimal operational API in MVP, postpone dashboard UI | moderation, shop |
| D-18 | P2 | Notification transport and frequency/preferences | Typed in-app first; push later after token/device plan | notification integrations |
| D-19 | P2 | Target load, budget, data residency and uptime needs | Stage deployment decision; avoid early cloud commitment | infra and SLO |

## Sign-off process

When a decision is made, record: ID, approved answer, who approved, approval date, impacted modules, Figma evidence IDs, acceptance tests and any new ADR. Updating a checkbox without recording the actual rule is insufficient.
