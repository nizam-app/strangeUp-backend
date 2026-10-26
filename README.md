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
- PostgreSQL for local development **or** [Prisma Dev](https://www.prisma.io/docs) (`npm run db:dev`) for a managed local Postgres process
- Optional: Docker for `docker-compose.yml` (not required on this machine if you use Prisma Dev or a local Postgres install)

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
| `npm run db:dev`           | Start local Postgres via Prisma Dev (alternative to Docker)                                  |

## Local PostgreSQL options

### Prisma Dev (recommended on Windows without Docker)

Use **two named instances** so development and integration tests never share a database:

```powershell
npx prisma dev --name strangeup_dev --detach
npx prisma dev --name strangeup_test --detach
npx prisma dev ls   # copy each instance TCP postgres:// URL (not the prisma+ proxy URL)
```

- Set **`DATABASE_URL`** in `.env` to the **strangeup_dev** TCP URL (`@prisma/adapter-pg` requires direct TCP).
- Set **`INTEGRATION_DATABASE_URL`** to the **strangeup_test** TCP URL.

Lifecycle (does not delete data):

```powershell
npx prisma dev stop strangeup_dev
npx prisma dev start strangeup_dev
npx prisma dev start strangeup_test   # if integration tests cannot connect
npx prisma dev ls                     # confirm TCP ports; update .env if ports changed
```

**Integration DB recovery:** If `INTEGRATION_DATABASE_URL` points at a stopped instance (connection refused on the test TCP port), run `npx prisma dev start strangeup_test`, then `npx prisma dev ls` and align `INTEGRATION_DATABASE_URL` with the **strangeup_test** TCP URL. Apply migrations to the test target only:

```powershell
$env:DATABASE_URL = "<INTEGRATION_DATABASE_URL from .env>"
npx prisma migrate deploy
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

The test harness refuses to run when `DATABASE_URL` and `INTEGRATION_DATABASE_URL` resolve to the same host/port/database path (fail-closed).

### Alternatives

1. **Docker Compose:** `docker compose up -d` (optional; not required for Task 001.1).
2. **Native PostgreSQL:** create separate `strangeup_dev` and `strangeup_test` databases and set the two URLs above.

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
