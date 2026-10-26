# Preliminary Authorization Matrix — Decision Pending

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
| Create activity | Not allowed | PENDING (D-05) | PENDING (D-05) | Creator permissions after approval | No special right | No special right |
| Join activity | Not allowed | PENDING (D-05) | PENDING (D-05) | Host action policy | Member policy | Member policy |
| Approve activity requests | Not allowed | Not allowed unless host | Not allowed unless host | Resource host only (proposed) | No special right | Only via defined moderation override |
| Create group | Not allowed | PENDING (D-06) | PENDING (D-06) | Owner on created group | No create privilege implied | Only platform policy |
| Approve group join | Not allowed | Not allowed unless scoped | Not allowed unless scoped | Group owner as configured | PENDING group role policy | Explicit admin override only |
| Send meetup invitation | Not allowed | PENDING (D-07) | PENDING (D-07) | User policy | User policy | No special right |
| Accept meetup invite | Not allowed | Recipient only + policy | Recipient only + policy | Recipient only | Recipient only | Never accept on someone else's behalf |
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
