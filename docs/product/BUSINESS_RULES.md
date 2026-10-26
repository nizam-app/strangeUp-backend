# Proposed Business Rules and Non-negotiable Engineering Invariants

**Source:** StrangeUp exported UI + engineering recommendations. Nothing marked PROPOSED is an owner-approved product rule.

## Invariants safe to enforce as engineering quality rules

1. All protected operations are authenticated and resource-authorized on the server.
2. Verification/premium/host/group labels displayed in UI do not automatically grant backend capabilities. Entitlement and trust state come from authoritative backend records.
3. Two simultaneous joins must not exceed activity capacity; no duplicate active request/participation per user + activity.
4. Retried critical mutations cannot double-charge, double-register, duplicate orders or resend the same notification indefinitely.
5. Only conversation participants may access message history; cross-module block/suspension policy is consulted.
6. Never expose government ID images, selfie biometrics, private email/phone, precise locations or sensitive auth fields through public profile DTOs.
7. Only an authorized group owner/moderator (as configured) can approve requests; activity host rights are scoped to that activity.
8. Membership privileges are derived from independently verified entitlements, not screenshots of checkout or client-supplied payment success.
9. Product orders store an immutable server-calculated price/discount/tax/fee snapshot, with currency and rounding explicit.
10. Notifications referencing secured resources must not bypass their resource ACL when opened.
11. Deleted, suspended or blocked accounts must not bypass policies through alternate endpoints or socket events.
12. State transitions emit auditable events and are safe to retry; maintain UTC instants and named IANA time zone for scheduled local events.

## Product rules that remain unresolved

- Who is eligible, when verification gates apply and whether the service is adults-only.
- Are Follow, Wave and Chat distinct actions; who can start contact; can unverified accounts view peers?
- Visibility default (public / nearby / group / private), location radius minimum and precise vs approximated locations.
- Activity join/host verification gates, booking approval, capacity/waitlist promotions, cancellation cutoffs, recurring events and paid RSVPs.
- Group public/private, invite-only access, admin/moderator capabilities, owner transfer/exit, content permissions.
- Meetup recipient eligibility, rescheduling protocol, invitation expiry, check-in and safety guidance.
- Premium features, quotas, monthly/yearly periods, seven-day trial eligibility, tax/discount computation, country/platform billing exceptions.
- Physical store type (official merchandise vs P2P), discounts, tax, stock reservation, QR handover, refunds and chargebacks.
- Whether Jobs use native applications or external URLs; which roles can post.
- Stories/feeds/polls scope, retention and content moderation.
- User data retention/deletion and identity-document retention terms.

## Prioritized contradictory visual fixtures

- #12 vs #42: yearly-plan display versus monthly checkout needs an explicit selected-SKU handoff and validated tax/trial summary.
- #13–15: member-priced merchandise receives another Club discount in cart; potential double discount.
- #33 vs #34/#37: signup identity completeness versus absent date of birth at that stage.
- #11 and related onboarding: E2EE/100%-verified claims require evidence before release.
- #05 vs #41: same named activity has inconsistent mock capacity. Do not seed production with design fixture numbers.
- #01/#47 and #09/#46: revised versions need source-of-truth confirmation.
