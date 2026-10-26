# User Journeys & State Machine Drafts

**Evidence boundary:** exported PDF screens establish visible entry/actions; transition semantics below are engineering PROPOSALS pending product approval. Never infer hidden Figma prototype links.

## Flow A — New account and trust (exports 27–30,31,33–35,48–49)

`Splash -> Onboarding -> Sign up/Login -> Account verification (conditional gate) -> ID upload -> Selfie/liveness -> Review decision -> Allowed product access`

- **OBSERVED:** sign-up fields; separate ID choice and selfie; stepper; personal info 'complete' before DOB collected in edit profile.
- **UNRESOLVED:** DOB intake, minimum age/country, what a pending/rejected user may do, provider callbacks, document retention, whether manual review applies.
- **PROPOSED states:** `UNSTARTED -> SESSION_CREATED -> DOC_PENDING -> SELFIE_PENDING -> REVIEW_PENDING -> VERIFIED|REJECTED|EXPIRED`, with retry policy, audit logs, webhook signature verification and robust failure modes. Account state and verification result should be distinct.

## Flow B — Activity RSVP and approvals (exports 04–07,41)

`Discover -> Read detail -> Request/Join -> (PENDING_APPROVAL | CONFIRMED | WAITLISTED) -> (CANCELLED | REJECTED | ATTENDED)`

- **OBSERVED:** capacity and waitlist controls; host approval; join/leave requests; verification label.
- **PROPOSED approach:** maintain a single current participation state per actor/activity (plus append-only transition/audit history). Seat is consumed only by confirmed state; all transitions are atomic and recheck eligibility/capacity. Waitlist does not grant chat/attendance rights unless explicitly approved.
- **UNRESOLVED:** approval vs auto-join conditions, what host can override, seat release/promotion, cancellation deadlines, invite-only audience, whether chargeable.

### Activity transition candidates

| Current | Actor / action | Proposed next | Guard |
|---|---|---|---|
| None | eligible user joins open activity | CONFIRMED or WAITLISTED | capacity, verification, membership, block, private visibility |
| None | user requests host approval | PENDING_APPROVAL | no duplicate unresolved request |
| PENDING_APPROVAL | host approves | CONFIRMED or WAITLISTED | capacity atomic check, scoped host auth |
| PENDING_APPROVAL | host declines | REJECTED | host auth and audit |
| CONFIRMED | user cancels/leaves | CANCELLED | policy, seat release, notify |
| WAITLISTED | capacity becomes available | CONFIRMED or PENDING_OFFER | decision on automatic promotion |
| CONFIRMED | authorized check-in | ATTENDED | event/check-in time policy |

**Concurrency invariant:** never exceed finite capacity. A row lock or atomic conditional update plus transaction and database uniqueness is required; client-side spots-left calculations are only presentational.

## Flow C — Group membership (exports 08–09,43–46)

`Discover group -> public join or private request -> approval if required -> membership -> scoped group content/chat -> leave/removed/banned`

**PROPOSED independent state dimensions:** member role (`OWNER|ADMIN|MODERATOR|MEMBER`), membership status (`ACTIVE|LEFT|REMOVED|BANNED`), join-request status (`PENDING|APPROVED|DECLINED|WITHDRAWN`). Do not conflate moderator authorization with account verified state. Group ownership transfer and last-owner protection need an approved policy.

## Flow D — Personal meetup invitations (exports 11,38–40)

`Chat/Profile -> Compose invite -> SEND -> Recipient inbox -> ACCEPT or DECLINE or PROPOSE_NEW_TIME -> Agreed meetup -> (CANCELLED | COMPLETED)`

**PROPOSED states:** `PENDING|COUNTER_PROPOSED|ACCEPTED|DECLINED|CANCELLED|EXPIRED|COMPLETED`. Reschedule must create a proposal the other participant accepts; it must not silently overwrite the accepted time. Only sender/recipient access details. Do not expose private locations to non-participants.

**UNRESOLVED:** who may invite, duration/expiry, whether inviting requires existing connection, recipient notification/privacy, check-in design, meeting safety.

## Flow E — Chat (exports 10,11)

`List/Requests -> Conversation access check -> text/media send with clientMessageId -> persisted message -> recipient delivery/read state`

- Proposed: durable ordered message IDs, idempotent send keys, unread tracking, per-conversation participant authorization, media moderation and blocked/suspended checks.
- Group chat follows group membership/role policy; direct chat follows interpersonal initiation rules. Presence/typing are ephemeral.
- 'End-to-End Encrypted' artwork text is not implementation evidence; do not claim it exists until cryptographic scope and audits are confirmed.

## Flow F — Membership versus physical shopping (exports 12–15,42)

- Digital premium: `select product -> store billing -> provider-verified notification/receipt -> purchase ledger -> entitlement projection -> expiration/refund/revocation`.
- Physical merchandise: `browse -> choose SKU -> cart -> server quote -> permitted physical-goods payment -> order/payment fulfillment -> pickup/delivery -> return/refund`.
- No shared payment success boolean between these domains. Prices, trial and tax figures in screenshots are mock design evidence, not production billing truth.

## Flow G — Safety enforcement (exports 25,37; cross-module)

`block/report/suspend -> policy recalculation -> affected discovery/chat/group/activity/meetup/notification visibility/actions -> audit -> appropriate appeal/deletion path`.

Default privacy should be conservative. Actual block visibility and existing historical content handling are unresolved product policies.
