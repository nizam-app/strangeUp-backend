# StrangeUp — Task 019B: Resend Transactional Email & Upstash Redis Provider Adapters

**Status:** IMPLEMENTATION INSTRUCTION — **OWNER APPROVAL REQUIRED FOR PROVIDER SELECTION AND ADAPTER IMPLEMENTATION**. Until approval, do not activate a third-party provider or send live email.  
**Scope:** Backend only; preserve Tasks 006–019.  
**Starting evidence:** Task 019 reported 182 passing unit tests; 97 passing + 1 intentionally skipped Neon integration tests; 13 applied Prisma migrations. Provider adapters currently unimplemented. Repository-wide formatting remains independently unresolved.

## 1. Product-owner decision gate

Implement this task only after the product owner explicitly authorizes **Resend** as transactional ESP and **Upstash Redis** as the initial distributed-rate-limit store. Approval to implement adapters is **not** authorization to send emails, change production infrastructure, or activate production modes. Activate those only under a separate explicit deployment authorization and local secret provisioning.

If the owner has not approved, report the precise approval required and do not call vendor APIs.

## 2. Inspect before editing

Read `AGENTS.md`, `.cursor/rules/*`, `src/modules/auth/email-sender.ts`, `auth-email-content.ts`, auth and settings challenge flows, `src/infrastructure/rate-limit/*`, `src/modules/auth/rate-limit.ts`, `src/config/env.ts`, `production-env-policy.ts`, `.env.example`, related tests and documentation. Match existing interfaces and do minimal diffs. Check official installed SDK versions and API contracts; don't invent package APIs.

## 3. Implement Resend adapter behind explicit configuration

- Use the current official Resend Node.js SDK (or a small typed HTTP adapter if justified); implement the existing `transactionalEmail` interface without changing externally documented auth DTOs.
- Select `TRANSACTIONAL_EMAIL_MODE=provider` only with valid `RESEND_API_KEY`, verified `TRANSACTIONAL_EMAIL_FROM`, `PUBLIC_APP_BASE_URL`, and production-safe URL settings. Keep `dev_stub` for dev/test and `disabled` for intentional fail-closed.
- Support **email verification, resend verification, password reset and email-change** requests and prior-address notices with correctly addressed, escaped plain text and/or safe HTML templates. Do not log tokens, URLs containing tokens, API keys, full request payloads or raw recipient PII. Never include raw tokens in API responses.
- Define transport results precisely: `handed_to_provider` means Resend accepted the API request, **not** inbox delivery. Handle malformed credentials, verification failures, API 429, timeouts, 5xx, and unexpected errors. Use bounded timeouts and carefully bounded retries; use a stable per-challenge/per-message **idempotency key** rather than per-account global keys. Do not retry permanent client errors.
- Preserve enumeration-safe public endpoints and existing rate limiting. Avoid leaving a usable challenge when sending definitively fails; recognize that a DB transaction cannot atomically include an external network call. For uncertain timeouts reconcile safely using stable idempotency or equivalent mechanism; never assume email reached inbox.
- For a previously verified email change, verify the new address through trusted challenge and password reauthentication; revoke sessions on completion. Treat old-address notice failure as a tracked security event rather than silently claiming the notification was delivered. Confirm the approved policy before changing security-critical flow behavior.
- Prefer dependency injection and adapter mocks for routine tests. **No real email send in automated test suites.** Provide an optional, explicit opt-in one-recipient smoke test once owner configures a verified sender and permits a real send.

## 4. Implement Upstash shared rate limiting

- Preserve the existing `RateLimitStore` interface and all endpoint keys, windows and thresholds. No broad behavioral rewrite.
- Because `RATE_LIMIT_REDIS_URL` already exists, use **Upstash native TLS TCP (`rediss://`)** with a compatible Node Redis client, unless the repository's exact interface makes the official Upstash REST SDK demonstrably preferable. If REST is chosen, explicitly document the changed env contract (`UPSTASH_REDIS_REST_URL`, token) and avoid pretending a TLS TCP URL is an HTTP URL.
- Use an **atomic** per-key increment+TTL window operation (server-side Lua or equivalent atomic primitive), with expiration, standardized `allowed`/`remaining`/reset semantics, namespaced keys, and no accidental persistent keys. Confirm compatibility with Upstash commands.
- Handle high concurrency, multiple backend processes sharing one key, reconnects, TLS validation, socket/command timeouts and shutdown. Never log credentials, disable TLS certificate verification, or buffer unlimited offline commands.
- In production, if the shared store is unavailable or times out, **fail closed** on abuse-sensitive actions with a safe `503` and no in-process-permissive fallback. Tests must prove that behavior. Dev/test may use existing memory backend.
- Add startup readiness checks that make `RATE_LIMIT_STORE=redis` usable with a valid URL and fail predictably with absent/invalid configuration. Do not introduce a permissive production mode inadvertently.

## 5. Verification

- Add deterministic unit tests for successful provider acceptance, rejected sends, timeouts, bounded retry/idempotency, email challenge retention/rollback, email-change reauthentication and old-email notice handling.
- Add distributed rate limiter tests (mock or dedicated isolated Redis) for same-key concurrence, window reset/TTL, multiple simulated app instances, key separation, and outage/timeout fail-closed behavior. A single shared JS memory map does **not** prove actual Redis integration.
- Preserve entire Neon `strangeup_test` suite. Run Prisma validation/generate, typecheck, lint, unit, build and integration tests. Report actual counts; do not claim live-vendor tests passed unless performed with authorized test credentials.
- Do not mass-format the repository; report pre-existing `format:check` failure separately.

## 6. Documentation and delivery

Update only relevant `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md`, `openapi/identity.yaml`, `STATUS.md`, `ACTIVE_SCOPE_AND_DEFERRALS.md`, `.env.example`, and `docs/operations/TRANSACTIONAL_EMAIL_AND_RATE_LIMITS.md`. Include non-secret setup checklist for verified sending domain, least-privilege Resend API key, Upstash database/TLS credentials, provider disabled-by-default config, and an explicit smoke-test toggle. Label provider accepted vs delivered, and identify what remains unverified in production.

Deliver a concise engineering report: changes, paths, credentials still needed (names only), selected Redis protocol, security invariants, all test counts, external smoke-test status, risks, and next launch blockers.

## 7. Strict constraints

No Flutter changes, migrations unless truly necessary, destructive database operations, commits, pushes, production config changes, third-party API calls with real credentials, or live email sends absent separate owner authorization. Keep D-06 interactive media disabled, D-08 paid membership unavailable, Task 014 checkout unavailable, and account deletion unimplemented. Never claim the backend production-ready solely because these adapters exist.
