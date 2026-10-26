# Open Product Decisions — Owner Review Queue

**State:** D-01, D-02 (core), D-02-AUTH, and D-09 (core) are **APPROVED** per ADR-004 and `IDENTITY_DECISION_REVIEW.md`. All other rows remain **OPEN** unless noted.

| ID | Priority | Status | Decision required | Blocks |
|---|---|---|---|---|
| D-01 | P0 | **APPROVED** | USA launch; adults-only 18+ | — (subsequent legal review may refine copy) |
| D-02 | P0 | **APPROVED*** | Email, password, DOB, legal acceptance; email verification before full access | — |
| D-02-AUTH | P0 | **APPROVED** | Email/password Phase 1; defer Google, Apple, phone OTP | — |
| D-09 | P0 | **APPROVED*** | Separate email / age / KYC dimensions; no live KYC provider yet | — |
| D-02-phone | P0 | OPEN | Mandatory phone collection and verification at signup? | signup UX, SMS vendor |
| D-09-provider | P0 | OPEN | KYC vendor selection and integration | live verification |
| D-09-retention | P0 | OPEN | Retention/deletion for verification and auth artifacts | compliance, ops |
| D-09-features | P0 | OPEN | Which features require KYC vs email+age only | discovery, activities, etc. |
| D-03 | P0 | OPEN | Who can see, follow, wave and message whom? | discovery, chat, invites |
| D-04 | P0 | OPEN | Exact location privacy | discovery, activity, meetups |
| D-05 | P0 | OPEN | Activity join policy | activities, host tools |
| D-06 | P0 | OPEN | Group membership policy | groups, group chat/content |
| D-07 | P0 | OPEN | Meetup eligibility and lifecycle | invitations, notifications |
| D-08 | P0 | OPEN | Digital Club entitlements and billing | membership gates |
| D-10 | P0 | OPEN | E2EE messaging claim | chat, marketing copy |
| D-11 | P1 | OPEN | Marketplace model | store |
| D-12 | P1 | OPEN | Merchandise pricing/tax/refunds | orders/payment |
| D-13 | P1 | OPEN | Jobs and Stories MVP priority | scope, roadmap |
| D-14 | P1 | OPEN | Home #47 / Group #46 authority | navigation, spec |
| D-15 | P1 | OPEN | Abuse reporting and moderation SLA | trust/safety |
| D-16 | P1 | OPEN | Jobs publisher model | jobs |
| D-17 | P1 | OPEN | Admin panel expectations | moderation, shop |
| D-18 | P2 | OPEN | Notification transport | notification integrations |
| D-19 | P2 | OPEN | Load, residency, uptime | infra and SLO |

\*Approved core rule recorded in ADR-004; starred rows still have **open sub-decisions** (phone, provider, retention, feature gates).

## Sign-off process

When a decision is made, record: ID, approved answer, who approved, approval date, impacted modules, Figma evidence IDs, acceptance tests and any new ADR. Updating a checkbox without recording the actual rule is insufficient.
