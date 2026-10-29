# Task 025A — Main Flow Home / main-shell engineering report

**Date:** 2026-10-28  
**Phase:** 025A **COMPLETE** (STOP — 025B not started)  
**Backend only** — no commits, deploys, or Flutter changes.

## 1. Source reconciliation

- Extracted owner ZIP to `design-reference/task025-main-flow/` (9 PDFs).
- **Corrected audit error:** `Screen 09_ Discover/Nearby People.pdf` **is included** (`9625e87f…`, 4 049 638 bytes). Prior claim that the ZIP omitted Screen 09 is **wrong** for this export.
- Screen 09 visible scope (design only): List/Map, search, filters (5 mi, Today, activity, age 22–35, verified), nearest-first label, distances, last-active, View Profile, Say Hi/Wave — **not implemented as APIs in 025A** (025B/D-04/COPY-TRUST).
- Task 022 gate documented: **main tabs require full activation**, superseding legacy browse-before-ID copy in older task markdown.

## 2. Home API verification (Screen 08 shared core)

| Endpoint | Role | Result |
|---|---|---|
| `GET /v1/home` | Dashboard composition | **Verified** — unchanged service; stories `DEFERRED`; no geo/presence fields |
| `GET /v1/me/community-feed` | Updated-variant feed | **Verified** — Task 013 behavior preserved |
| `GET /v1/me/notifications` | Bell inbox | **Verified** — unread syncs to `notificationsUnreadCount` (T013-H03) |
| `GET /v1/me/messaging/summary` | Messages tab badge | **Verified** — separate from home (T025A-H03) |

**Updated-variant-only fields** (`myGroups`, `communityFeedPreview`, `upcomingGroupActivities`) remain LIVE; Flutter may hide when HOME-08 chooses original-only UX.

## 3. Code / contract changes

| File | Change |
|---|---|
| `openapi/home.yaml` | 403 description aligned with Task 022 denial codes (was generic AUTH_FORBIDDEN) |
| `tests/integration/main-flow-025a.integration.test.ts` | **Added** T025A-H01–H03 bounded integration tests |
| `design-reference/task025-main-flow/MANIFEST.md` | **Added** SHA-256 manifest + Screen 09 correction |
| `docs/product/FIGMA_MAIN_FLOW_PARITY_TASK025A.md` | **Added** shared vs updated Home matrix + Screen 09 table |
| `docs/product/FIGMA_AUTH_FLOW_PARITY_TASK022.md` | Home row points to Main Flow 025A matrix |
| `docs/api/FLUTTER_DEVELOPER_HANDOFF.md` | Main Flow 025A pointer; Screen 08 dual-variant notes |
| `docs/api/CURRENT_APIS.md` | 025A test + parity doc references |

**No production schema migrations.** No changes to `/v1/home` response shape or business logic — audit found **no confirmed home-service defects** requiring code repair beyond OpenAPI accuracy.

## 4. Tests executed

Commands (local):

```bash
npm run typecheck
npm run lint
npm run build
npm run test
RUN_INTEGRATION=1 npm run test:integration -- tests/integration/main-flow-025a.integration.test.ts tests/integration/home.integration.test.ts
```

**Results (2026-10-28 local):**

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `npm run test` | **231/231** unit tests pass |
| Focused integration (`RUN_INTEGRATION=1`, `main-flow-025a` + `home`) | **Not run** — `INTEGRATION_DATABASE_URL` unset in this environment; tests are present and skip when `RUN_INTEGRATION≠1` |

Re-run on Neon `strangeup_test`:

```bash
set RUN_INTEGRATION=1
set INTEGRATION_DATABASE_URL=postgresql://.../strangeup_test?sslmode=require
npm run test:integration -- tests/integration/main-flow-025a.integration.test.ts tests/integration/home.integration.test.ts
```

## 5. Owner decisions still open

- **HOME-08** — authoritative Screen 08 variant  
- **D-04** — geo/radius/map/presence  
- **D-06** — stories  
- **COPY-TRUST** — verified badges, active peer counts, ratings copy  
- **Discover target visibility** — whether email-only accounts should appear in peer lists (current Task 009 policy: targets need email+age only; viewers need full activation) — **not changed in 025A**

## 6. Next bounded step

**025B** — Screen 09 discover filters/sorting only where grounded; still no fabricated geo/presence.
