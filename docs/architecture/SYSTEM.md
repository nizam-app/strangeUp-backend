# System Architecture — Proposed v0.2

**Approval:** engineering recommendation, not an irreversible owner decision. **Confirmed stack:** Node.js, TypeScript, Express, Prisma, PostgreSQL, Flutter client.

## Primary proposal: modular monolith

```text
Flutter iOS/Android
  -> HTTPS REST /v1/* (typed DTOs, auth, resource ACL, idempotency)
  -> Event transport (later, for chat; authenticated socket + scoped room auth)
Node.js + Express modular application
  Core: config, database, validation, error codes, auth/policy, observability
  Domains: identity, profile, verification, discovery, social actions,
           activities, groups, messaging, meetups, feed/stories,
           membership, commerce, jobs, notifications, moderation, admin
Prisma ORM -> PostgreSQL (transactional source of truth)
Future conditional adapters: object storage, push/email, identity provider,
                       app store billing providers, payment gateway, Redis/queue
```

## Dependency policies

- Domain modules expose narrow application interfaces; other modules do not directly mutate their tables.
- Transport controllers validate/authenticate, delegate to domain services, serialize DTOs, never embed business logic.
- Shared authorization policies for block/suspension/verification/entitlement; enforce per resource and every WebSocket action too.
- Database transaction boundaries live in application services; use idempotency for purchase, registration, response and message create.
- Event-driven side effects only after commit; consider outbox once reliable notifications/payments demand it. Never fire-and-forget critical side effects.
- Separate public profile DTOs from private identity/credential records; no Prisma object auto-serialization.
- One shared error contract, request IDs, structured redacted logs and basic health endpoints.

## Observability and operations

- `/health/live` for process liveness; `/health/ready` for dependency readiness; no sensitive config.
- Graceful shutdown, bounded errors, separate local/staging/production env, backup/migration runbooks.
- Do not assume scale, SLO or hosting provider until usage and region known.

## Media, geo, security and billing boundary

- Media upload URLs and moderation are gated; object-storage provider decision later.
- Location representations must separate private precise values from public coarse outputs.
- KYC provider docs and selfies are sensitive; provider-held whenever feasible; retention policies pending.
- Digital subscriptions and physical order payments are separate domains and provider adapters.

## Future extension points, not present dependencies

- Socket.IO / WebSocket for chat and typing once messaging is built.
- Redis for distributed rate-limit/session/presence if deployment topology requires it.
- Queue/outbox workers for notifications and webhooks once demand established.
- Geospatial extension/PostGIS only after search scale/precision rules justify it.

## First implementation scope

Repo skeleton + express bootstrap + config validation + common middleware + Prisma connection + Postgres local setup + tests/CI + OpenAPI foundation. No product tables or business endpoints in Task 001.
