# Transactional email and distributed rate limiting (Tasks 019 / 019B)

**Status:** Resend and Upstash Redis **adapters implemented** (owner-approved vendors). **Live production activation** and real external sends require separate deployment authorization, verified domain, and secrets in the deployment environment — **not** enabled by default in repo or CI.

## Transactional email (Resend)

| Flow | Dev/test (`dev_stub`) | Production `disabled` | Production `provider` + creds |
|---|---|---|---|
| Registration / resend verification | Stub capture/log | Fail closed; challenge rolled back | `handed_to_provider` via Resend API (not inbox delivery) |
| Password reset | Stub; enumeration-safe `202` | `202`; challenge removed if send fails | Same via Resend |
| Email change | `DEV_ONLY` / `PROVIDER` label | `403` without handoff | Resend to new address; prior-email notice with security audit log on failure |

**Semantics:** `handed_to_provider` = Resend accepted the HTTP request. Delivery/bounce tracking is out of scope until webhooks are authorized.

**Environment**

- `TRANSACTIONAL_EMAIL_MODE`: `dev_stub` | `disabled` | `provider`
- `RESEND_API_KEY`, `TRANSACTIONAL_EMAIL_FROM`, `PUBLIC_APP_BASE_URL` (required for provider in production)
- `RESEND_REQUEST_TIMEOUT_MS`, `RESEND_MAX_RETRIES`
- Per-challenge `idempotencyKey` on sends (in-process dedupe + Resend `Idempotency-Key` header)
- Optional manual smoke: `RESEND_SMOKE_TEST=1` and `RESEND_SMOKE_TO` (never in automated suites)

## Rate limiting (Upstash Redis, `rediss://`)

Protocol: **native TLS TCP** via `ioredis` and `RATE_LIMIT_REDIS_URL` (Upstash-provided `rediss://` URL). Atomic fixed-window Lua (`INCR` + `PEXPIRE` on first hit).

| Store | When | Behavior |
|---|---|---|
| `memory` | Dev/test default | In-process fixed window |
| `fail_closed` | Production without Redis | `503` on abuse-sensitive routes |
| `redis` | Production with Upstash URL | Shared limits; command timeout → fail closed |

Startup: `npm start` runs PING readiness when `RATE_LIMIT_STORE=redis`.

## Pre-launch checklist (ops)

1. Resend: verified domain, least-privilege API key, `TRANSACTIONAL_EMAIL_FROM` on that domain.
2. Upstash: database created, copy **TLS** URL into `RATE_LIMIT_REDIS_URL`.
3. Set production env explicitly (secrets manager — never git): `TRANSACTIONAL_EMAIL_MODE=provider`, `RATE_LIMIT_STORE=redis`.
4. Run optional Resend smoke to one approved recipient before go-live.
5. Monitor Resend bounces/complaints and Redis latency separately (not implemented in this task).
