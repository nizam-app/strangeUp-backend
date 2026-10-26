# StrangeUp Engineering Status (as of 2026-10-26)

| Scope | Status | Evidence / blockers |
|---|---|---|
| Figma exported visual discovery | REVIEWED | 49 PDF exports, 39 UI screens/variants, 10 auxiliary; cannot confirm original Figma prototype links |
| Product specification | DRAFT | `PRD_DRAFT.md`, owner sign-off outstanding |
| Screen traceability | DRAFT COMPLETE | 39 CSV-based mapped records; source evidence from PDFs |
| MVP selection | RECOMMENDED, NOT APPROVED | pending D-01..D-19 product decisions |
| Architecture | PROPOSED | modular monolith; owner technology stack confirmed |
| Conceptual data model | PROPOSED | no executable Prisma business schema |
| API design | PROPOSED | foundation envelope + health only; no `/v1` product routes |
| **Task 001 — backend foundation** | **IMPLEMENTED** | Express, config, health, Prisma 7 adapter, unit tests, CI workflow |
| **Task 001.1 — local DB + Git baseline** | **VERIFIED (local)** | Prisma Dev `strangeup_dev` / `strangeup_test`, ready 200/503, integration test executed, local git init |
| Local PostgreSQL (Prisma Dev) | **VERIFIED** | TCP dev `localhost:51214`, test `localhost:51218` (ports may change after restart — use `npx prisma dev ls`) |
| Integration test (live PostgreSQL) | **VERIFIED** | `RUN_INTEGRATION=1` + `INTEGRATION_DATABASE_URL`; 1 test passed (real `SELECT 1` via `/health/ready`) |
| Unit tests / quality gates | **VERIFIED** | typecheck, lint, format:check, 11 unit tests, build |
| Repository git (local) | **VERIFIED** | `git init` + initial commit; `.env` and `generated/` excluded |
| Native PostgreSQL concurrency testing | **NOT RUN** | Prisma Dev PGlite-backed local service used; full native Postgres perf/locking deferred |
| Payment/verification provider choices | UNRESOLVED | D-01..D-19 open |
| Deployment | UNRESOLVED | no remote or production deploy |

## Task 001.1 evidence summary

- **DB approach:** Prisma ORM 7 `prisma dev` named instances (no Docker).
- **HTTP:** `/health/live` → 200; `/health/ready` → 200 with DB up; → 503 after `prisma dev stop strangeup_dev` (sanitized body + `requestId`).
- **Integration:** `integration: GET /health/ready > returns 200 against a real PostgreSQL instance` (not skipped when enabled).
- **Isolation:** integration harness requires `INTEGRATION_DATABASE_URL` and rejects identical dev/test targets.

## Immediate next steps

1. Owner sign-off on **D-01..D-10** before Task 002 (identity/user schema + auth/policy).
2. Optional: install native PostgreSQL for heavier concurrency integration tests later.
3. Add Git remote and push only when approved (no remote configured in Task 001.1).
