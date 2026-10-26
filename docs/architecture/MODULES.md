# Module Ownership and Cross-Cutting Dependencies — Proposed

| Module | Owns | Depends on / exposes |
|---|---|---|
| `auth` | credential/session/verification challenges | users, sessions; denies anonymous protected calls |
| `users` + `profiles` | account lifecycle, profiles, interests, privacy config | auth identity, moderation blocks |
| `trust` | verification orchestration, evidence refs, risk flags | provider adapter, user state, moderation |
| `discovery` | queries/list/map filtering | profiles, privacy policy, trust, blocks |
| `social` | Follow, Wave, connection/request | profile/consent eligibility; chat initiation gate |
| `activities` | activities, registration, waitlist, host approval | auth, trust, geo, notifications, membership if enforced |
| `groups` | groups, memberships, join requests, scoped roles | auth, trust, moderation, feeds, group-chat ACL |
| `feed` | posts, comments, reactions | group visibility, moderation, notifications |
| `stories` | expiry-scoped story/media viewers | feed/group visibility, storage, jobs later |
| `messaging` | conversations, messages, receipts | group membership, social approval, blocking, realtime |
| `meetups` | person-to-person invitations and reschedule proposals | contact eligibility, private locations, notifications |
| `memberships` | plans, subscription ledger, entitlements | app store purchase provider adapter, permissions |
| `commerce` | merchandise SKU/catalog/cart/order/fulfillment | prices, physical-goods payment provider, member discounts |
| `jobs` | job directory, saves/applications | identity, publisher role, moderation |
| `notifications` | inbox, preferences, delivery ledger | user settings, event contracts, deeplink ACL |
| `moderation` + `admin` | report, block, restrictions, audit and operational UI/API | centrally consulted in all interaction modules |

## Dependency rule

Infrastructure adapters import domain contracts, not vice versa; allow one-way module calls through interfaces, avoid circular imports and avoid uncontrolled direct cross-module table writes. Add modules only when a scoped feature begins. Group moderators and hosts do not automatically gain any platform administrator rights.
