# Candidate Endpoint Inventory — For Contract Planning Only

**Status:** PROPOSED. Names, responses, authorization and even the existence of some capabilities are not approved. Not a demand to implement all endpoints. Every endpoint needs actor/resource test matrix before build.

| Proposed endpoint family | Source exports | Expected gate | Key unresolved behavior |
|---|---|---|---|
| `POST /v1/auth/register`, `/login`, `/refresh`, `/logout` | 31,33 | guest/auth/session | DOB, age, social auth, challenge policies |
| `POST /v1/auth/forgot-password`, `/reset-password` | 31,35 | rate-limited public + token proof | enumeration and email delivery |
| `POST /v1/verification/sessions`, `GET /status` | 34,48,49 | own account + KYC policy | provider, retry/appeal and data retention |
| `GET/PATCH /v1/me/profile` | 25,37 | owner only | partial fields, sensitivity, trust checks |
| `GET /v1/users/:id` | 03 | visibility/privacy/block | public DTO and field projection |
| `GET /v1/discovery/people` | 02 | account/privacy/eligibility | region, fuzzy coords, preferences |
| `POST /v1/users/:id/follow` / `/wave` | 02,03 | relationship/consent policy | difference between follow and wave |
| `GET/POST /v1/activities`, `GET /:id` | 04,05,07 | public/privacy/host scope | draft/publish, venue precision |
| `POST /v1/activities/:id/join` | 04,05 | trust/block/capacity | auto join or request or waitlist |
| `POST /v1/activities/:id/requests/:requestId/approve` | 41 | scoped activity host | concurrency, waiting list promotion |
| `GET/POST /v1/groups`, `GET /:id` | 08,44,46 | visibility + group role | private/public ownership & caps |
| `POST /v1/groups/:id/join` / `/requests/:reqId/approve` | 43–45 | membership + group admin | membership request states |
| `GET/POST /v1/groups/:id/posts` | 09,46 | membership/visibility | content/poll moderation |
| `GET/POST /v1/conversations`, `GET/POST /:id/messages` | 10,11 | participant plus trust/block | request/consent and encryption |
| `GET/POST /v1/meetup-invites`, `POST /:id/accept|decline|propose-time` | 38–40 | sender/recipient only | counter-proposal, expiry and meetup privacy |
| `GET /v1/notifications`, `PATCH /:id/read` | 36 | notification recipient | deep-link and notification preference |
| `GET /v1/membership/plans`, `GET /me/entitlements` | 12,42 | auth or catalog read | actual benefits/limits and billing cycle |
| `POST /v1/billing/verify-purchase`, signed provider callbacks | 42 | verified provider transaction | provider/platform/country, idempotency |
| `GET /v1/store/products`, `/cart`, `POST /v1/orders/checkout` | 13–15 | actor+stock+pricing | official store, member discounts, refunds |
| `GET /v1/jobs`, `POST /:id/save|apply` | 23 | reader + publisher model | native apply vs external redirects |
| `POST /v1/reports`, `POST /v1/blocks` | 25,37 | authenticated + safety | moderation categories and action effects |
| `GET /v1/admin/reports`, `POST /:id/actions` | no platform-admin UI | trusted scoped moderator | staff policy and audit workflow |

## Per-contract required fields

OpenAPI summary; source screen ID; auth and resource policy; request DTO and validations; response projection; persistence side effects; typed errors; idempotency; rate limits; notification side effects; failing/retry/concurrency tests.
