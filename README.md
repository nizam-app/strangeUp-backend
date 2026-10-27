# StrangeUp Backend

Foundation service for the StrangeUp mobile client (Flutter). **Task 001** provides process bootstrap, configuration validation, observability hooks, health checks, and Prisma/PostgreSQL wiring **without product business tables or domain APIs**.

## Stack

- Node.js 22+ (LTS)
- TypeScript, Express 5
- Prisma 7 + PostgreSQL (`@prisma/adapter-pg`)
- Zod (strict env validation), Pino, Vitest, ESLint, Prettier

See `AGENTS.md`, `docs/architecture/SYSTEM.md`, and `cursor_tasks/TASK_001_BACKEND_FOUNDATION.md`.

**API docs for Flutter:** live routes in `docs/api/CURRENT_APIS.md`; integration guide in `docs/api/FLUTTER_DEVELOPER_HANDOFF.md`.

## Prerequisites

- Node.js **22+** and npm
- [Neon PostgreSQL](https://neon.tech) for local development and integration (**recommended**) — two isolated catalogs: `strangeup_dev` and `strangeup_test`
- Optional fallbacks: native PostgreSQL 18 on `localhost:5432`, [Prisma Dev](https://www.prisma.io/docs) (`npm run db:dev`), or Docker Compose

## Quick start (development)

```bash
npm install
npm run prisma:generate
cp .env.example .env
# Edit DATABASE_URL in .env

npm run dev
```

Health checks:

- `GET /health/live` — process liveness (no database)
- `GET /health/ready` — includes a bounded `SELECT 1` database check

## Scripts

| Script                     | Purpose                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run dev`              | Start API with hot reload (`tsx`)                                                            |
| `npm run build`            | Compile TypeScript to `dist/`                                                                |
| `npm start`                | Run compiled server (`dist/src/server.js`)                                                   |
| `npm run typecheck`        | TypeScript check                                                                             |
| `npm run lint`             | ESLint                                                                                       |
| `npm run format:check`     | Prettier check                                                                               |
| `npm test`                 | Unit tests (no live DB required)                                                             |
| `npm run test:integration` | DB integration when `RUN_INTEGRATION=1` + **`INTEGRATION_DATABASE_URL`** (separate from dev) |
| `npm run prisma:generate`  | Generate Prisma client into `generated/prisma`                                               |
| `npm run db:neon:prepare`  | Create isolated Neon catalogs `strangeup_dev` / `strangeup_test` if missing                  |
| `npm run db:neon:migrate`  | Forward-only `prisma migrate deploy` on both Neon catalogs (direct hosts)                    |
| `npm run db:neon:health`   | Redacted identity + applied-migration check                                                  |
| `npm run db:dev`           | Start local Postgres via Prisma Dev (fallback only)                                          |

## Local PostgreSQL options

### Neon PostgreSQL (recommended)

Use **two isolated Neon catalogs** (separate projects / endpoints):

| `.env` variable            | Database         |
| -------------------------- | ---------------- |
| `DATABASE_URL`             | `strangeup_dev`  |
| `INTEGRATION_DATABASE_URL` | `strangeup_test` |

```powershell
npm run db:neon:prepare
npm run db:neon:migrate
npm run db:neon:health
```

Full steps: `docs/operations/NEON_POSTGRES.md`.

Integration tests **require** `strangeup_test`, reject `neondb` / `strangeup_dev` / Prisma Dev ports (`51213`–`51216`), and verify `SELECT current_database()` before running (see `tests/setup/integration-database-guard.ts`). Never TRUNCATE `strangeup_dev`, `neondb`, or production.

### Native PostgreSQL 18 (fallback)

See `docs/operations/NATIVE_POSTGRES_LOCAL.md` if you run Postgres locally on `:5432` instead of Neon.

### Prisma Dev (fallback only)

Preserved in `.env` comments for recovery. Do **not** use for integration tests after Neon cutover.

```powershell
npx prisma dev start strangeup_dev
npx prisma dev ls   # TCP URL on port 51214 etc.
```

Uncomment Prisma URLs in `.env` only if you intentionally roll back from Neon.

### Other alternatives

1. **Docker Compose:** `docker compose up -d` (optional).

### Integration tests

```powershell
$env:RUN_INTEGRATION = "1"
npm run test:integration
Remove-Item Env:RUN_INTEGRATION -ErrorAction SilentlyContinue
```

Without `RUN_INTEGRATION=1`, the real DB test is skipped by design.

Identity Phase 1 schema and migrations live under `prisma/migrations/` (see `docs/plans/STATUS.md`).

## API envelope (foundation)

Documented in `docs/api/FOUNDATION_ENVELOPE.md`. Versioned product routes under `/v1/*` are **not** implemented yet.

## CI

GitHub Actions workflow: `.github/workflows/ci.yml` (lint, typecheck, unit tests, build).

# strangeUp-backend
