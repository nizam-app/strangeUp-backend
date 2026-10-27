# Preliminary Authorization Matrix — Decision Pending

**KYC (APPROVED 2026-10-26, `KYC_OWNER_DECISIONS_002B3A2.md`):** KYC-01/03/05 and KYC-ENF-01..05 documented. Real-world in-person/hybrid join, RSVP accept, check-in, host publish/activate, waitlist promotion, meetup invite send require **current valid provider-backed KYC**; 100% virtual-only exempt; waitlist entry without KYC allowed. **Not enforced in code.** Ops residuals: `D-09-kyc-enforcement-ops`.

This is an **engineering authorization checklist**, not an approved permission grant. Every `PENDING` requires explicit owner sign-off. Actor relationships and verification state are separate from global platform roles. **Default: deny unless a positive rule is established.**

| Capability | Guest | Registered | Verified status | Resource host/owner | Group moderator | Platform moderator |
|---|---|---|---|---|---|---|
| Register/login | Allowed public endpoint | N/A | N/A | N/A | N/A | N/A |
| View public profile | UNRESOLVED | UNRESOLVED | UNRESOLVED | Same user policy | Same user policy | Case-based audited access |
| Edit own profile | Not allowed | Own profile | Own profile | Own only | Own only | No arbitrary edits without explicit admin policy |
| Discover users | UNRESOLVED | UNRESOLVED | UNRESOLVED | User policy applies | User policy applies | User policy applies |
| Follow / Wave | Not allowed | PENDING (D-03) | PENDING (D-03) | Actor policy applies | Actor policy applies | Actor policy applies |
| Start direct chat | Not allowed | PENDING (D-03) | PENDING (D-03) | Actor policy applies | Actor policy applies | No unrestricted contact |
| View/send in direct chat | Not allowed | Participant only + policy | Participant only + policy | Participant only | Participant only | No ordinary conversation read access by default |
| Create activity | Not allowed | PENDING (D-05) | PENDING (D-05); **KYC** before publish/activate if in-person/hybrid | Creator permissions after approval | No special right | No special right |
| Join activity | Not allowed | PENDING (D-05) | PENDING (D-05); **KYC** before confirm + at check-in if in-person/hybrid; virtual-only exempt | Host action policy | Member policy | Member policy |
| Join activity waitlist | Not allowed | PENDING (D-05) | Waitlist without KYC OK; promotion requires KYC | Host policy | Member policy | Member policy |
| Approve activity requests | Not allowed | Not allowed unless host | Not allowed unless host | Resource host only (proposed) | No special right | Only via defined moderation override |
| Create group | Not allowed | Eligible full-access account (Task 012 provisional; D-06 open) | KYC **not** required merely to create/join a group | Owner on created group | No create privilege implied | Only platform policy |
| Approve group join | Not allowed | Not allowed unless scoped | Not allowed unless scoped | Group owner | Group moderator (Task 012 provisional) | Explicit admin override only |
| Send meetup invitation (real-world) | Not allowed | PENDING (D-07) | Sender **KYC APPROVED** required | User policy | User policy | No special right |
| Accept meetup invite (real-world) | Not allowed | Recipient only + policy | Recipient **KYC APPROVED** before confirm | Recipient only | Recipient only | Never accept on someone else's behalf |
| Access premium benefit | No | Active entitlement only | Active entitlement only | Entitlement applies | Entitlement applies | No silent complimentary access |
| Create reports / block | UNRESOLVED | Own report/block controls | Own report/block controls | Own report/block controls | Own report/block controls | Audited moderator action |
| Resolve platform moderation case | No | No | No | No | Own group only if explicitly allowed | Scoped and audited global permission |
| Fulfill physical order | No | No | No | No | No | Distinct operator permission needed |

## Cross-cutting enforcement checklist

- A `verified` attribute is **not** the same as an authorization role.
- A user can be a host for one activity and not another; moderator for one group and not all groups.
- Re-evaluate block, account lock/suspension, profile visibility and membership entitlement on sensitive reads and writes.
- Notifications and sockets must re-check target resource authorization; do not rely solely on issued tokens or previously joined rooms.
- Platform staff access to identity documents, conversations or geolocation needs an explicit minimal policy and audit trail, not a blanket admin bypass.

## Evidence references

#02–03 discovery/contact, #04–07 and #41 activities, #08–09/#43–46 groups, #10–11 chat, #25/#37 settings, #38–40 private meetups, #12/#42 membership, #13–15 merchandise. Exact rules not proven by screenshots.
