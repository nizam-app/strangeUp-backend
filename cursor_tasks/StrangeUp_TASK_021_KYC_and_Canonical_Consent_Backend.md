# StrangeUp — Task 021: Trusted KYC Integration & Canonical Consent Enforcement

**Scope:** BACKEND ONLY (Node.js / TypeScript / Express / Prisma / Neon); substantial implementation, not a documentation-only milestone.

**Owner status:** Veriff is the recommended candidate, **not selected or authorized until owner explicitly approves**. Implementation must preserve KYC fail-closed until real vendor credentials, signing secrets, and production activation are authorized. Consent text/version values are likewise not authorized until owner/legal approval. No Flutter code.

## Read first
- `AGENTS.md`, `.cursor/rules/*`, current `docs/decisions/` especially KYC-01, KYC-03, KYC-05, KYC-ENF-01..05, D-02 consent policy, current `docs/product/OPEN_QUESTIONS.md` and D-03.
- Inspect `src/modules/auth`, identity policy and status schema, activity publish/RSVP/meeting, public visibility/discovery, relevant tests, `prisma/schema.prisma`, migration list, `src/config/production-env-policy.ts`.
- `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`, appropriate OpenAPI specs.
- Work against actual repository contracts; don't assume class, enum, or route naming. Avoid duplication or speculative schema fields.

## Deliverable A — Canonical server-controlled consent versions (implement now)
1. Inventory all currently required consents for US adults-only registration, authentication, KYC and job applications. Locate the current client-supplied `applicationConsentVersion` path and consent record fields. Record what is actually required versus proposed; don't invent legal copy or version IDs.
2. Build a server-owned **canonical document/version registry**: `{documentId, versionId, effectiveFrom, status, resource URL or content hash when available}`; values must originate in owner-approved config/data, never arbitrary client text. Avoid placing personal consent in an untrusted default.
3. Implement precise validation and immutable per-user acceptance/audit records (user, consent document/version, timestamp, relevant event). Where product legal/consent text is not approved, expose an explicit PENDING/UNAVAILABLE capability and fail closed on the relevant activation—not by silently inventing v1 IDs. Do not break existing non-related profile/discovery flow.
4. Existing registration and application paths must be inspected for backward compatibility. A request cannot claim acceptance of an unknown or obsolete version. Propose a safe version rollover migration, but do not rewrite applied migrations or force retroactive acceptance.
5. Give the Flutter developer an accurate endpoint/DTO or server-supplied accepted-version contract for registration and future KYC; no Flutter code. Don't claim legal advice or production consent sufficiency.
6. Test unknown, stale, missing, duplicate and replayed acceptance; enforce appropriate consent only at approved legal trigger points.

## Deliverable B — Trusted KYC sessions, provider adapter, webhook processing (Veriff adapter only after owner approval)
1. Reuse the existing approved KYC requirements and the current identity status fields. Minimal provider evidence only: provider name, opaque session ID, attempt ID, status, decision time, verification policy/recheck metadata; **do not store raw ID photos, selfie, biometric data, document number, or full webhook payloads**.
2. Build KYC self-service status/session contract backed by provider interfaces; when provider is disabled, return accurate `NOT_CONFIGURED` / `FEATURE_DISABLED`, never client-provided `APPROVED`.
3. If/when owner approves **Veriff**: implement a real server-side Veriff session adapter using official API; strict allowlisted endpoint/base URL, authenticated session creation, session-to-current-user binding using opaque ID, bounded timeouts and retries; avoid storing session URL in logs. Session URL can be returned only to initiating authenticated user, over HTTPS, with suitable expiry.
4. Implement signed decision webhook verification against the **raw HTTP body** with provider's current documented `x-hmac-signature` semantics, constant-time comparison, credentials/environment isolation, request-size limits, strict schema validation, and no public unauthenticated status changes. Reject unsigned/invalid payloads. Veriff webhooks are at-least-once and can arrive out of order; ensure idempotent event/session handling, prevent old attempts overwriting newer authoritative decisions, and don't let replay revive a revoked state. HTTP acknowledgement should occur after safely committing, or through a durable queue if used.
5. Map `approved`, `declined`, `resubmission_requested`, `review` (only if available), `expired`, `abandoned` to approved internal statuses; all non-approved states deny KYC-gated actions. DO NOT build an owner/manual approval endpoint (KYC-03 says provider-validated only). Handle revocation/expiry safely and recheck KYC at join, waitlist promotion, publish/activate, invitation transitions and meeting-detail access. 100% virtual exception remains unchanged. A user's prior approval must not be inferred forever from a stale field.
6. Verify response content is privacy-minimal; public profile may show a trustworthy generic badge only when backed by genuinely valid provider approval and owner-approved mapping. Membership status never confers KYC.
7. Use sandbox/mock fixtures for unit/integration tests; **NO real vendor API requests** until credentials and owner-approved sandbox call. No production activation. If Veriff has NOT been approved, implement the provider-neutral portion only and mark Veriff-specific steps BLOCKED BY OWNER; do not sneak in SDK or live calls.

## Deliverable C — Security, reliability and testing
- Forward-only migrations only as needed; migrations must apply to isolated Neon `strangeup_dev` and `strangeup_test`. Never reset/truncate development, production, or other catalogs.
- Add integration tests covering: fake unsigned/invalid signatures, tampered body, replay, duplicate/out-of-order webhook, cross-account session binding, concurrent session attempts, approved/declined/expired/revoked, KYC vs email verification, real-world publish/join/waitlist promotion/invitation/meeting privacy, and virtual exemption. Assert no PII leaks.
- Run `prisma:validate`, `prisma:generate`, `typecheck`, `lint`, `test`, `build`, full `RUN_INTEGRATION=1 npm run test:integration` on isolated Neon. Report formatting drift honestly without mass rewrite.
- Production safety must fail closed when credentials, webhook secrets, canonical consent IDs or provider are unconfigured. Preserve existing functionality and previous Tasks 001–020. Keep D-06 off, paid Club/checkout off, destructive account deletion unavailable.
- Synchronize `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md`, relevant OpenAPI, `STATUS.md`, `ACTIVE_SCOPE_AND_DEFERRALS.md`, owner decision ledger; accurately distinguish implemented, mocked, live-verified, deferred, and policy pending. Provide one engineering report showing changed files/endpoints, actual tests, remaining secrets/decisions, and operational runbook.
- NO Flutter implementation, deployment, production data or vendor calls, commits, pushes, mass formatting, or destructive DB operations without authorization.

## Official Veriff technical reference (when approved)
- Flutter plugin: https://devdocs.veriff.com/docs/flutter-plugin
- Create verification session: https://devdocs.veriff.com/v1-api/apidocs/v1sessions
- Webhook events: https://devdocs.veriff.com/docs/webhooks-guide
- HMAC raw body: https://devdocs.veriff.com/v1/docs/hmac-authentication-and-endpoint-security

**Acceptance:** Real backend implementation, not only schema and docs; no forged/unsupported KYC approvals; canonical consents do not accept arbitrary client versions; full tests and accurate report; production remains fail-closed.
