# STRANGEUP — TASK 002B.1

**Title:** Identity schema migration + email/password auth core
**Status:** READY TO EXECUTE (after 002A1 approvals)
**Predecessors:** Task 001, 001.1, 002A, 002A1
**Owner decisions:** ADR-004 (D-01, D-02, D-02-AUTH, D-09)

## Objective

First **implementation** slice for identity: Prisma migrations and `/v1` auth/account endpoints for **email/password** with **email verification gate** and **USA 18+ age check** at registration. No OAuth, phone OTP, or live KYC provider.

## In scope

1. Prisma models (minimal approved set): `User`, `PasswordCredential`, `Session`, `AuthChallenge`, `ConsentRecord`, `Profile` (DOB + display fields per D-02).
2. `auth` module routes:
   - `POST /v1/auth/register`, `/login`, `/refresh`, `/logout`, `/logout-all`
   - `POST /v1/auth/email-verification/request`, `/confirm`
3. Account state: restricted until email verified + age eligible; separate trust fields per D-09.
4. Policy stubs: `canAccessAccount`, `canEditProfile`, `canStartVerification`, `canAccessOwnVerificationStatus`, `canInteractWithUser` (deny).
5. Email sender **interface** + dev stub (no production vendor required in first PR).
6. Env keys in `.env.example` only (secrets not committed).
7. Unit + API tests; integration tests for unique email and session rotation where feasible.
8. **Mandatory doc updates:** `docs/api/CURRENT_APIS.md`, `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` §7, OpenAPI fragment for new routes.

## Out of scope (defer to 002B.2+)

- Password reset (`/password-reset/*`) unless explicitly pulled into 002B.1
- `GET/PATCH /v1/me/profile` full profile media
- KYC session stub and webhooks
- `UserBlock`, discovery, social, messaging
- Google/Apple/phone auth
- Native PostgreSQL concurrency suite (plan per `IDENTITY_ACCEPTANCE_MATRIX.md`)

## Gates

- Typecheck, lint, unit tests pass; integration optional with `RUN_INTEGRATION=1`.
- No claim of production-ready email delivery or KYC.
- Update `docs/plans/STATUS.md` with implementation evidence.

## References

- `docs/architecture/IDENTITY_DESIGN_PROPOSAL.md`
- `docs/api/IDENTITY_API_DRAFT.md`
- `docs/testing/IDENTITY_ACCEPTANCE_MATRIX.md` (I-P01–I-P05, I-N01–I-N04, I-N08–I-N10 minimum)
