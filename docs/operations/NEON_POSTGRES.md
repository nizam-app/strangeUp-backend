# Neon PostgreSQL — local development & integration

**Approved topology (2026-10-27):** two isolated Neon projects / endpoints:

| Variable | Catalog | Purpose |
|---|---|---|
| `DATABASE_URL` | `strangeup_dev` | Local API / `npm run dev` |
| `INTEGRATION_DATABASE_URL` | `strangeup_test` | `RUN_INTEGRATION=1` only (TRUNCATE per test) |

Use **direct** (non-pooler) hosts for one-time catalog creation and `prisma migrate deploy`. Runtime may keep Neon **pooler** URLs. Never point integration tests at `neondb`, `strangeup_dev`, Prisma Dev ports (`51213`–`51216`), or production.

Do **not** run integration TRUNCATE or cleanup against `strangeup_dev`, `neondb`, or production. Each Neon project may still have an unused default `neondb` catalog — leave it idle; never migrate or truncate it.

## 1. Configure `.env` (never commit secrets)

Create two Neon databases (separate projects recommended) named `strangeup_dev` and `strangeup_test`. Example shape only — replace host and credentials locally:

```env
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/strangeup_dev?sslmode=require
INTEGRATION_DATABASE_URL=postgresql://USER:PASSWORD@ep-yyyy-pooler.REGION.aws.neon.tech/strangeup_test?sslmode=require
```

If the Neon console still issues the default `neondb` path, run the prepare script below. It creates the named catalogs on each project (via a direct connection) and retargets `.env` paths. It never migrates or truncates `neondb`.

Prisma Dev and native `localhost:5432` URLs may remain as commented fallbacks only.

## 2. Prepare catalogs and apply migrations (forward-only)

```powershell
cd strangeup-backend
npm run db:neon:prepare
npm run db:neon:migrate
npm run db:neon:health
```

`db:neon:migrate` runs `prisma migrate deploy` against each named catalog using a direct Neon host. It does **not** run `migrate reset` or `db push`.

## 3. Verify identity before integration tests

```powershell
$env:RUN_INTEGRATION = "1"
npm run test:integration
Remove-Item Env:RUN_INTEGRATION -ErrorAction SilentlyContinue
```

The harness requires:

- `INTEGRATION_DATABASE_URL` catalog name **`strangeup_test`**
- Not the same host/path as `DATABASE_URL`
- Not Prisma Dev ports
- Not `neondb`
- Live `SELECT current_database()` matches `strangeup_test`

## 4. Fallback

Native PostgreSQL 18 on `localhost:5432` remains documented in `NATIVE_POSTGRES_LOCAL.md`. Prisma Dev TCP URLs remain in `.env` comments. Do not use either as the default after Neon cutover.
