# Native PostgreSQL 18 — optional local fallback

**Default local topology is Neon** (`docs/operations/NEON_POSTGRES.md`). Use this document only if you intentionally run PostgreSQL 18 on `localhost:5432`.

**Fallback topology:** PostgreSQL 18 on `localhost:5432`, separate databases:

| Variable | Database | Purpose |
|---|---|---|
| `DATABASE_URL` | `strangeup_dev` | Local API / `npm run dev` |
| `INTEGRATION_DATABASE_URL` | `strangeup_test` | `RUN_INTEGRATION=1` only (TRUNCATE per test) |

Prisma Dev URLs remain documented as **fallback** in `.env` comments; do not point integration tests at `template1` or port `51214`.

## 1. Create role and databases (one-time)

Use the **postgres** superuser password from installation (not stored in this repo).

**PowerShell (interactive):**

```powershell
cd strangeup-backend
.\scripts\setup-native-databases.ps1
```

**Or SQL (edit password placeholder first):**

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -p 5432 -d postgres -f scripts/setup-native-databases.sql
```

If `strangeup` or a database already exists, skip or adjust the failing statement manually.

## 2. Configure `.env` (never commit secrets)

```env
DATABASE_URL=postgresql://strangeup:<PASSWORD>@localhost:5432/strangeup_dev?schema=public
INTEGRATION_DATABASE_URL=postgresql://strangeup:<PASSWORD>@localhost:5432/strangeup_test?schema=public
```

Keep commented Prisma Dev URLs as fallback reference only.

## 3. Apply migrations (forward-only)

```powershell
$env:DATABASE_URL = "<copy strangeup_dev URL from .env>"
npx prisma migrate deploy
$env:DATABASE_URL = "<copy strangeup_test URL from .env>"
npx prisma migrate deploy
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

Does **not** copy or reset data from Prisma Dev `template1`.

## 4. Verify identity before integration tests

```powershell
$env:RUN_INTEGRATION = "1"
npm run test:integration
```

The harness requires:

- `INTEGRATION_DATABASE_URL` database name **`strangeup_test`**
- Not the same path as `DATABASE_URL`
- Not Prisma Dev ports (`51213`–`51216`)
- Live `SELECT current_database()` matches `strangeup_test`

## 5. Rollback

Point `.env` back to commented Prisma Dev TCP URLs. Native databases are unchanged.
