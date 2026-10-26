# StrangeUp Engineering Status (as of 2026-10-26)

| Scope | Status | Evidence / blockers |
|---|---|---|
| Figma exported visual discovery | REVIEWED | 49 PDF exports, 39 UI screens/variants, 10 auxiliary; cannot confirm original Figma prototype links |
| Product specification | DRAFT | `PRD_DRAFT.md`; identity Phase 1 decisions approved (ADR-004) |
| Screen traceability | DRAFT COMPLETE | 39 CSV-based mapped records; source evidence from PDFs |
| MVP selection | PARTIAL | D-01, D-02, D-02-AUTH, D-09 approved; D-03..D-19 largely open |
| Architecture | PROPOSED | modular monolith; owner technology stack confirmed |
| Conceptual data model | **IMPLEMENTED (identity slice)** | Prisma migration `20261026065612_identity_phase1` |
| API design | **PARTIAL LIVE** | `/health/*`, `/v1/auth/*`, `/v1/me/account`, `/v1/me/profile` |
| **Task 001 — backend foundation** | **IMPLEMENTED** | Express, config, health, Prisma 7 adapter, unit tests, CI workflow |
| **Task 001.1 — local DB + Git baseline** | **VERIFIED (local)** | Prisma Dev instances, ready 200/503, integration health test |
| **Task 002A / 002A1** | **COMPLETE (docs)** | ADR-004, API/handoff docs |
| **Task 002B.1 — identity schema + email auth** | **IMPLEMENTED (local)** | Migration, auth module, policy stubs, OpenAPI `identity.yaml` |
| **Task 002B.1A — auth security review & closure** | **VERIFIED (local)** | Targeted fixes; expanded auth integration tests |
| **Task 002B.2 — reset + self account/profile** | **IMPLEMENTED (local)** | Password reset, `/v1/me/*`, docs + integration tests |
| **Task 002B.2A — auth stabilization** | **VERIFIED (local)** | `strangeup_test` restored; scrypt p=5 preferred + rehash-on-login; full quality gate |
| Local PostgreSQL (Prisma Dev) | **VERIFIED** | TCP dev URL via `npx prisma dev ls`; test instance may need restart if port stale |
| Integration test (live PostgreSQL) | **VERIFIED** | Against dedicated `strangeup_test` TCP instance (`localhost:51218`); PGlite-backed Prisma Dev, not native PG |
| Unit tests / quality gates | **VERIFIED** | typecheck, lint, format:check, 24 unit tests, build (Task 002B.2) |
| Consent document versions | **RELEASE BLOCKER** | Server records client-supplied versions; counsel canonical IDs not configured |
| Email delivery | **DEV STUB ONLY** | Password reset + verification not production-ready |
| Distributed rate limiting | **OPEN** | In-memory `Map` only; multi-replica deployment needs shared limiter |
| Native PostgreSQL concurrency testing | **PARTIAL** | I-C03 password-reset race verified on PGlite-backed instance; I-C01–I-C02, I-C04 still NOT VERIFIED on native PG |
| Payment/verification provider choices | UNRESOLVED | KYC vendor open (D-09 sub-decisions) |
| Deployment | UNRESOLVED | no remote or production deploy |

## Task 002B.2A stabilization (2026-10-26)

- **Test isolation:** `npx prisma dev start strangeup_test`; dev `localhost:51214/template1` vs integration `localhost:51218/template1` (distinct Prisma Dev instances).
- **Password hashing:** New hashes use scrypt **N=16384, r=8, p=5** (~224ms benchmark on dev machine); legacy **p=1** hashes remain valid; successful login rehashes to preferred parameters.
- **Docs:** README integration recovery workflow.

## Task 002B.2 implementation summary

- **Password recovery:** `POST /v1/auth/password-reset/request|confirm` using `AuthChallenge` type `PASSWORD_RESET`; session revocation on confirm; enumeration-safe 202; rate limits per IP/email.
- **Self account:** `GET /v1/me/account` for pending + active users (not suspended/deleted).
- **Profile:** `GET` / `PATCH /v1/me/profile` with strict allowlist (`firstName`, `lastName`, `displayName`, `bio`, `scheduleTimeZone`); edits require verified email + age eligible.
- **Hardening:** scrypt verify now applies stored `N/r/p`; per-user cap on email verification resend; optional `PUBLIC_APP_BASE_URL` for reset links.
- **Docs:** `CURRENT_APIS.md`, `FLUTTER_DEVELOPER_HANDOFF.md` §8–9, `openapi/identity.yaml`, `IDENTITY_ACCEPTANCE_MATRIX.md` §002B.2.

## Immediate next steps

1. Owner: restore or re-point `INTEGRATION_DATABASE_URL` if `strangeup_test` Prisma Dev instance is stopped (see README).
2. **002B.3+** (not started): stub KYC sessions, account deletion workflow — requires new approval.
3. Production email provider + distributed abuse controls before staging forgot-password UX.
4. Native PostgreSQL concurrency suite (I-C01–I-C02, I-C04) on CI.
5. Git logical commits / remote when owner approves.
