# STRANGEUP — CURSOR TASK 001.1

**Title:** Local PostgreSQL readiness, real integration verification, and Git foundation  
**Status:** READY TO EXECUTE — DEVELOPMENT ENVIRONMENT ONLY  
**Parent task:** TASK_001_BACKEND_FOUNDATION.md  
**Working directory (reported):** `D:\TONMOY-TR\strangeUp\strangeup-backend`

## Goal

Finish the remaining verifiable foundation acceptance checks before any identity, authentication, or other business module is implemented. Preserve all working Task 001 code, architecture, documentation, and dependency versions.

The Task 001 report states that 11 unit tests, typechecking, linting, formatting, compilation, and HTTP liveness passed. Database readiness returned 503 because PostgreSQL was unavailable; the integration runner passed but its real database test was skipped. No local Git repository exists. These are reports, not independently verified by ChatGPT.

## Non-negotiable boundaries

- Work **only on the local development repository**. Do not touch Figma, production, staging, external cloud accounts, hosted databases, or production credentials.
- Do not create business models or modules (User, Auth, Profile, KYC, Chat, Activity, Order, etc.) and do not add placeholder migrations just to look complete.
- **Do not** run `prisma migrate reset`, `prisma db push`, a destructive `DROP`, or any production migration as a workaround.
- Do not install Docker merely to fulfill this task. Docker is not currently installed and is optional.
- Do not upgrade to Prisma 8 or change major versions. Check the installed Prisma 7 local CLI behavior before invoking its `dev` subcommand; keep lockfile consistent.
- Never print, report, commit, or log real DATABASE_URL credentials or `.env` contents. Report only the DB host/port and **redacted** database identifiers if necessary.
- Keep development and integration-test databases isolated; never execute test cleanup against the development DB.
- Ask for approval before overwriting existing files, changing architecture, or any destructive local action.

## Step 1 — Inspect before changes

1. Confirm current working directory and inspect `README.md`, `package.json`, `package-lock.json`, `prisma7.config.ts`, `prisma/schema.prisma`, `src/infrastructure/database/prisma.ts`, `src/routes/health.ts`, `tests/`, `vitest.integration.config.ts`, `.env.example`, `.gitignore`, and `.github/workflows/ci.yml`.
2. Inspect `docs/plans/STATUS.md` and `cursor_tasks/TASK_001_BACKEND_FOUNDATION.md`.
3. Confirm `node -v`, `npm -v`, `npx prisma --version`, and the exact scripts available with `npm run`.
4. Determine how `.env` is loaded by runtime and how `INTEGRATION_DATABASE_URL` is passed to tests. Avoid assuming the test runner actually switches databases.
5. Check if there is a Git repository at this path or in a parent directory before initializing anything. Check `.gitignore` coverage for `.env`, `.env.*` (except `.env.example`), `node_modules`, generated Prisma client, build artifacts and logs.

## Step 2 — Bring up local database safely

Preferred initial path: **Prisma ORM 7 local Prisma Postgres** (works without Docker; suitable for smoke testing). Use a separately installed/native PostgreSQL service instead if one is already running and appropriate. Do not provision a cloud DB.

On Windows PowerShell, run in the repo directory:

```powershell
npx prisma --version
npx prisma dev --name strangeup_dev --detach
npx prisma dev --name strangeup_test --detach
```

If the project's existing `npm run db:dev` command safely wraps the same Prisma 7 operation, you may use it instead. Do not replace a known-good command unnecessarily.

Important: Prisma Dev may allocate **different ports** to named instances. Copy each actual TCP **`postgres://` or `postgresql://` URL** from the CLI output or safe supported listing command; do not invent URLs, assume port 5432, or mix the instances. For `@prisma/adapter-pg`, verify a direct PostgreSQL TCP connection string is used rather than blindly pasting an HTTP/proxy scheme. Never paste these values into the completion report.

Create `.env` from `.env.example` only if absent. Set `DATABASE_URL` to the development instance. Configure `INTEGRATION_DATABASE_URL` as the separate test instance according to the existing test harness. Make any minimal environment-loading fix needed to ensure integration tests use the test DB, documenting it. Do not expose secrets in commits, logs, CI output or reports.

The CLI's local PostgreSQL service can be backed by PGlite; it is sufficient for initial connectivity smoke tests, **not an automatic substitute for full native PostgreSQL concurrency/locking/performance tests** later.

## Step 3 — Verify live readiness and HTTP behavior

1. Run `npm run prisma:validate` and `npm run prisma:generate` against existing approved empty schema.
2. Run the app using the documented local run command. Record that `/health/live` returns 200 **and** `/health/ready` returns 200 only while the configured database is reachable.
3. Make a controlled, temporary **local-only** DB disconnect / stopped-instance test. Confirm readiness returns 503, with a sanitized stable error response and request ID. Restart the same instance. Do **not** delete the instance or its storage.
4. Validate startup/shutdown behavior and Prisma cleanup; verify no passwords or tokens appear in logs.
5. Verify unknown route and invalid JSON behavior still match the documented error envelope. Inspect HTTP response details, not merely exit codes.
6. If local Prisma Postgres cannot be started, explain the exact issue and provide the **native Windows PostgreSQL** alternative; do not fake a pass.

## Step 4 — Run real integration tests

Ensure `RUN_INTEGRATION=1` triggers a real database test, not a skipped or placeholder test. For PowerShell:

```powershell
$env:RUN_INTEGRATION = "1"
npm run test:integration
Remove-Item Env:RUN_INTEGRATION -ErrorAction SilentlyContinue
```

Tests must use **INTEGRATION_DATABASE_URL only** (separate from the runtime `DATABASE_URL`). Add a defensive fail-fast guard in the test setup if the values are identical or if test DB config is missing. Never rely on a fake mock to prove DB connectivity. With an empty Prisma schema, a safe `SELECT 1` connection check and connection-failure assertion are sufficient; do not create product tables or run destructive cleanup.

Re-run:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:integration
npm run build
```

The second integration command (without `RUN_INTEGRATION=1`) may intentionally skip DB tests; report the enabled and disabled runs **separately** so nobody confuses a skipped test with verified DB connectivity.

## Step 5 — Establish Git baseline (local only)

1. Before `git init`, confirm this folder is the intended repository root and not already inside an existing Git repository; inspect `git rev-parse --show-toplevel` and status.
2. Initialize local Git only when appropriate: `git init`.
3. Validate ignore rules before staging. Explicitly verify `.env`, `.env.*` secrets, `node_modules`, generated Prisma client, test DB artifacts and build output are not staged.
4. Stage only source, lockfile, docs, safe sample configs and tests. Review `git status --short` and staged filenames before committing.
5. Create a single descriptive local initial commit (e.g. `chore: establish StrangeUp backend foundation`) **only if** the stage is clean and no secrets are included. If author identity is missing, report the blocker rather than inventing it.
6. Do not create a remote, push, open a pull request or enable automatic deployment without approval.

## Step 6 — Update verification status and handoff docs

Update `README.md` and `docs/plans/STATUS.md` with what actually worked, exact local start/stop commands for named database instances, and explicit results for ready 200, offline 503, real DB integration, Git baseline and optional native PostgreSQL testing. Keep D-01..D-19 unresolved until owner decisions are documented. Do not silently approve the PRD or architectural choices.

## Acceptance gates

- The backend still typechecks, lints, formats, tests and builds.
- Local development DB connected; health readiness 200 confirmed **with the DB running**.
- Readiness 503 confirmed when the DB is unavailable, without disclosing details.
- The integration test **actually executed** with `RUN_INTEGRATION=1`, and used a distinct test database.
- No domain models, live KYC/payment services, migrations or destructive operations introduced.
- Git initialized locally if safe, `.env` and generated artifacts excluded, baseline commit made if possible.
- Documentation reports VERIFIED versus UNVERIFIED accurately.

## Final Cursor report — required

Provide: inspected files, minimal changes and why; commands actually executed and results; DB approach chosen (Prisma Dev or native), local connectivity proof (credentials redacted); `health/live` and `health/ready` HTTP status evidence; actual integration test name/count and skipped count; Git repository and commit status; relevant security checks; unresolved blockers; and precise next recommendation. **Do not report full completion if the integration test was skipped or Git/secrets were not checked.**
