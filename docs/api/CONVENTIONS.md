# REST API Conventions — Proposed

## Basic contract

- Base path `/v1`; JSON UTF-8; camelCase payloads; fixed ISO-8601 UTC instant representation and IANA time zone field when needed.
- Input schemas validate all untrusted strings, IDs, numbers, date/time and uploaded media metadata. Strict request size limits.
- Prefer `GET` for pure reads; `POST`/`PATCH`/`DELETE` for explicit mutations. Always authorize target resources.
- DTOs are curated public representations, **never direct ORM model dumps**.
- Cursor-based pagination on feeds/messages/discovery rather than offset pagination at scale.
- Search filters have typed constraints and a documented maximum limit; no arbitrary Prisma field exposure.

## Envelope example — only a proposal

Success: `{ "data": { ... }, "meta": { "requestId": "..." } }`  
Failure: `{ "error": { "code": "AUTH_FORBIDDEN", "message": "Not allowed", "requestId": "..." } }`

Use HTTP 400/401/403/404/409/422/429/5xx as appropriate; 404 may be used to avoid leaking private resource existence. Application error codes stay stable, while debug details only in redacted server logs.

## Proposed endpoint families (NOT approved API contracts)

- `POST /v1/auth/register|login|refresh|logout|forgot-password|reset-password`.
- `GET/PATCH /v1/me/profile`; `GET /v1/users/:id`; privacy-scoped discovery queries.
- `GET/POST /v1/activities`; `POST /v1/activities/:id/join`; `POST /v1/activities/:id/requests/:requestId/approve`.
- `GET/POST /v1/groups`; `POST /v1/groups/:id/join`; moderation routes for scoped group admins.
- `GET/POST /v1/conversations`; `GET/POST /v1/conversations/:id/messages` with clientMessageId.
- `GET/POST /v1/meetup-invites`; `POST /v1/meetup-invites/:id/accept|decline|propose-time`.
- `GET /v1/notifications`; `PATCH /v1/notifications/:id/read`.
- Premium purchase/provider webhooks and physical store orders under separate domain routers (later).

## Mutation safeguards

- Idempotency: client supplies idempotency key for critical operations; backend scopes keys by authenticated actor + operation and stores outcome or ledger effect. Validate payload consistency for reused keys.
- Validation and auth error must not reveal PII; enforce per-IP/device/identity limits at auth, search, chat, invite endpoints.
- Provider webhooks must verify signature, replay uniqueness and out-of-order event handling before altering any entitlement/order.
- Do not expose raw precise location, identity documents, refresh tokens, password hashes or payment card data in any response.
- OpenAPI and endpoint-level auth/permission matrix evolve with approved UI flows.
