# Test Strategy & Quality Gates

## Pyramid

- Unit tests: validators, helpers, domain transition functions, policy decisions and pricing/entitlement rules when approved.
- Integration: real test PostgreSQL, Prisma constraints, transactions, auth and resource-based authorization.
- API contract tests: route schemas, HTTP codes, request IDs and OpenAPI examples.
- End-to-end backend workflow tests: user signup -> verified status -> discover -> request/approve -> chat/meetup -> notify; later billing/order lifecycle.
- Concurrency/security tests: seat contention, idempotency, replay, block bypass, schema injection and PII leakage.

## First milestone (Task 001) acceptance gates

1. TypeScript typecheck, ESLint, formatting check and test runner are runnable.
2. Health liveness route works and readiness is based on actual dependency check (no fake healthy result when DB offline).
3. Application starts/stops gracefully and validates env (no secret values in logs).
4. Integration smoke test can run with isolated local test DB; no production credential use.
5. CI triggers lint, typecheck, tests and optional test-DB integration for PRs.
6. All errors are sanitized, contain traceable request IDs and do not expose stacks in production mode.
7. Database connection and migration commands are documented, with no initial product schema presumed.
8. Every generated file is reported and all commands/tests are marked pass/fail/not run with evidence.

## Critical negative scenarios for feature milestones

| Feature | Negative / race test |
|---|---|
| Identity | wrong/expired reset token, brute-force, unverifiable OAuth token, revoked session |
| Profile | unauthorized edit and leak of email/phone/DOB/coordinates |
| Activity | two simultaneous joins into one spot, duplicate join, approval stale state, host spoofing |
| Group | private-group access without membership, self-promotion to moderator |
| Chat | nonparticipant read/send, blocked sender, replayed clientMessageId, unauthorized attachment |
| Meetup | third-party invite access, accept a cancelled invite, concurrent reschedule |
| Membership | replay/refund/out-of-order provider webhooks, revoked entitlement |
| Commerce | double discount, total mismatch, oversell, duplicate checkout, partial payment error |
| Moderation | suspended user bypass via alternate endpoint/socket; missing audit entry |

**Definition of done:** specified and approved behavior, implementation, input validation, least-privilege auth, transaction/data correctness, passing relevant tests, API/docs, security review, no known blockers. A generated code file alone never counts as tested.
