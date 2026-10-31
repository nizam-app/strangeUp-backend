# Manual KYC sandbox runtime (Task 031J-1)

Isolated **non-production** stack for Cloudinary manual KYC smoke tests against Neon catalog **`strangeup_test`** only. Default `npm run dev` remains on **`strangeup_dev`** and is unchanged.

## Topology

| Process | Command | Port | Database / upstream |
|---------|---------|------|---------------------|
| Dev API (unchanged) | `npm run dev` | **3000** | `DATABASE_URL` → `strangeup_dev` |
| Manual KYC test API | `npm run dev:manual-kyc-test` | **3010** | `INTEGRATION_DATABASE_URL` → `strangeup_test` (guarded) |
| Dev Admin BFF | `npm run dev` (admin) | **3001** / Vite **5173** | `BACKEND_BASE_URL` → `:3000` |
| Manual KYC Admin | `npm run dev:manual-kyc-test` (admin) | **3011** / Vite **5174** | `BACKEND_BASE_URL` → `:3010` |

## One-time setup

1. Ensure base `strangeUp-backend/.env` has `INTEGRATION_DATABASE_URL` (catalog **`strangeup_test`**) and JWT secrets.
2. Copy `strangeUp-backend/.env.manual-kyc-test.example` → `.env.manual-kyc-test.local`.
3. Add Cloudinary sandbox credentials to `.env.manual-kyc-test.local` (see below).
4. Copy `strangeUp-admin-panel/.env.manual-kyc-test.example` → `.env.manual-kyc-test.local` (or reuse `SESSION_SECRET` from admin `.env`).

## Database identity guard (mandatory)

Before the test API listens, `scripts/start-manual-kyc-test-api.ts`:

1. Resolves DB URL from `MANUAL_KYC_TEST_DATABASE_SOURCE=integration` → `INTEGRATION_DATABASE_URL` (URL policy: catalog name must be `strangeup_test`).
2. Runs live `SELECT current_database()` — must equal **`strangeup_test`**.
3. Refuses **PORT=3000** (dev collision).
4. Validates env via `loadEnv()` (`KYC_IDENTITY_AUTHORITY=manual` requires Cloudinary vars).

No migrations or writes are performed by the startup script.

## Cloudinary (owner — server-only)

Required when `KYC_IDENTITY_AUTHORITY=manual`:

| Variable | Required | Notes |
|----------|----------|--------|
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | Yes | API Key (not upload preset) |
| `CLOUDINARY_API_SECRET` | Yes | Exact API secret from Cloudinary dashboard (server only) |
| `CLOUDINARY_KYC_EVIDENCE_FOLDER` | Optional | Default `strangeup/kyc-evidence`; use a **sandbox-only** folder for smoke tests |

Audit without exposing values:

```powershell
cd strangeUp-backend
npm run manual-kyc-test:check-config
```

## KYC flags (test overlay only)

Set in `.env.manual-kyc-test.local` only — **not** in base `.env` used by `npm run dev`:

```env
KYC_PROVIDER_ENABLED=false
KYC_PROVIDER=none
KYC_IDENTITY_AUTHORITY=manual
KYC_MANUAL_REVIEW_ENABLED=true
VERIFF_LIVE_CALLS_ENABLED=false
```

Veriff adapter code stays in the repo; provider path remains inactive.

## Evidence delivery (reviewed)

- Upload uses Cloudinary **authenticated** assets (`type=authenticated`); no public delivery URLs in API DTOs.
- List/metadata responses expose `evidenceId`, `kind`, sizes — **never** `cloudinaryPublicId` or Cloudinary URLs to clients.
- Staff bytes: backend `Cache-Control: private, no-store`; Admin BFF proxies with the same header on manual evidence and avatar routes.

## Start sandbox

Terminal 1 — test API:

```powershell
cd strangeUp-backend
npm run dev:manual-kyc-test
```

Terminal 2 — Admin against test API:

```powershell
cd strangeUp-admin-panel
npm run dev:manual-kyc-test
```

Open Admin UI at `http://localhost:5174` (proxied BFF on **3011**).

## Migration status

Neon **`strangeup_test` is 28/28**, including `20261030180000_task031im1_manual_kyc_cloudinary_evidence`, `20261031120000_task032c_account_moderation_decision` (`AccountModerationDecision`), and `20261031140000_task033d_activity_moderation_decision` (`ActivityModerationDecision`). **`strangeup_dev` remains 23 migrations** and must not receive these writes from the test launcher. Owner applies remaining migrations to dev/production separately.

## Task 032E Users Management sandbox (2026-10-31)

| Check | Result |
|-------|--------|
| Test API DB guard (`current_database()`) | **`strangeup_test`** on **:3010** |
| Admin BFF | **:3011** → `BACKEND_BASE_URL=http://127.0.0.1:3010` |
| Admin Vite | **:5174** (5175 also allowed) |
| Users List / Details GET | **PASS** (API + BFF + browser) |
| Temporary SUPER_ADMIN on existing synthetic IDENTITY_REVIEWER | **Granted then revoked** |
| Suspend / Restore / audit / idempotency / 401/403/400 | **PASS** (60/60 scripted E2E) |
| Session + device-token revocation + Home denial | **PASS** |
| Immediate socket disconnect after committed suspend | **PASS** (active authenticated socket evicted) |
| IDENTITY_REVIEWER-only UI | View-only; no Suspend/Restore actions |
| Final target status | **ACTIVE**, `suspendedAt=null` |
| Veriff / Manual KYC | **Unchanged** (`KYC_IDENTITY_AUTHORITY=manual`) |

Do **not** use this launcher against `strangeup_dev`, production, or default API **:3000**.

## Task 031J-2A completion (2026-10-30)

| Check | Result |
|-------|--------|
| `manual-kyc-test:check-config` | **PASS** (Cloudinary creds from base `.env`) |
| `scripts/manual-kyc-smoke-031j2.ts` | **37/37 PASS** (two consecutive runs) |
| Cloudinary authenticated **upload** | **PASS** (sandbox folder) |
| Cloudinary authenticated **download** (staff bytes) | **PASS** after download-signature fix (`format` + no `api_key` in signature) |
| Public `res.cloudinary.com/.../upload/` | **Blocked** (401/404) |
| Step A / Step B / Home gate | **PASS** (API) |
| Admin login (synthetic `PlatformStaffGrant` reviewer) | **PASS** (browser, :5174 → BFF :3010) |
| Verification **detail** + manual evidence inspector | **PASS** (browser — passport 2-slot + national ID front/back; BFF-proxied bytes, zoom/rotate) |
| Verification **list** Pending tab for Step A (`IN_REVIEW`) | **Expected empty** — list `PENDING` tab uses provider-approved queue criteria; manual Step A uses direct `/verification/:reviewId` until identity APPROVED |

## Task 031J-2 smoke results (2026-10-30)

| Check | Result |
|-------|--------|
| `npm run manual-kyc-test:check-config` | **PASS** after relaxing `CLOUDINARY_API_SECRET` min length (dashboard secrets can be &lt;32 chars) |
| Base `.env` `DATABASE_URL` catalog | **`strangeup_dev`** (unchanged) |
| Test API DB guard (`current_database()`) | **`strangeup_test`** on **:3010** |
| KYC overlay flags | `manual` / manual review on / provider off / Veriff live off |
| Cloudinary folder (overlay) | `strangeup/kyc-evidence-sandbox` |
| Cloudinary authenticated upload | **BLOCKED** — Cloudinary API returns `Invalid cloud_name` for configured `CLOUDINARY_CLOUD_NAME`; owner must set exact cloud name from dashboard |
| Manual session start (synthetic user) | **PASS** (no Cloudinary leak in JSON) |
| Evidence upload / staff bytes / Step A+B / Home gate | **Not completed** (depends on Cloudinary upload) |
| Admin sandbox stack | BFF **3011** OK; Vite may bind **5175** if **5174** busy — align `ALLOWED_ORIGINS` or free **5174** |
| API smoke runner | `npx tsx scripts/manual-kyc-smoke-031j2.ts` (against **:3010** only) |
| Admin UI visual (list/details/inspector) | **Pending** until Cloudinary upload succeeds |

**Owner action:** Fix `CLOUDINARY_CLOUD_NAME` (and re-verify key/secret) in base `.env`, re-run check-config, then smoke script + Admin **5174/5175** evidence inspector.

## First controlled smoke (checklist)

1. Confirm `npm run manual-kyc-test:check-config` exits 0.
2. Start test API + Admin sandbox stack.
3. Register or use a test user on **:3010** only (not dev :3000).
4. Start manual KYC session + upload synthetic test images (owner-approved).
5. Staff login on Admin **5174** → verify manual evidence metadata + proxied bytes (no Cloudinary URL in network tab JSON).

Do **not** use production catalogs or real identity documents until owner sign-off.
