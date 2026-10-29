# Task 028D — Personal meetup REST (create + inbox + detail)

**Date:** 2026-10-29  
**Phase:** **028D COMPLETE** — **STOP before 028E** (accept/decline/withdraw).  
**Decision:** D-28 foundation (028C).

---

## Endpoints (LIVE)

| Method | Path | Status |
|--------|------|--------|
| `POST` | `/v1/meetup-invites` | **LIVE** |
| `GET` | `/v1/meetup-invites` | **LIVE** |
| `GET` | `/v1/meetup-invites/:inviteId` | **LIVE** |

Router: `mountMainApp("/v1/meetup-invites", …)` — Task 022 gate on all routes.

---

## Security notes

- Recipient lookup reuses `loadVisibleSocialTarget` (D-03 + blocks + discoverable target).
- **Fix (028D):** `social-access.ts` `targetSelect` now loads Task 022 session/admin fields so discoverability checks are truthful for follow/wave/meetup create.
- Participant-only reads; blocks → **404**; non-participants → **404**.
- List omits blocked-peer invites; list/detail venue redaction enforced in mapper.
- No client-controlled `status` or actor IDs.
- Sender KYC enforced on create (`hasTrustedKycForActivityAction`).
- Idempotency: scoped `meetup-invite:create:{senderId}:{key}`; payload hash mismatch → **409**.

---

## Database

- **strangeup_test:** migration `20261029170000_task028c_personal_meetup_invitation` applied (028C).
- **strangeup_dev:** not migrated in this phase. Sync locally with:
  ```bash
  npm run db:neon:migrate
  ```
  (runs both dev + test per script; or use `npx tsx scripts/migrate-integration-only.ts` for test-only.)

---

## Tests

| Command | Result |
|---------|--------|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run build` | pass |
| `npm run test` | **276** unit pass |
| `RUN_INTEGRATION=1 npm run test:integration -- tests/integration/meetup-invite-028d.integration.test.ts` | **5/5** |
| `meetup-invite-schema-028c.integration.test.ts` | **2/2** (regression) |

---

## Deferred (unchanged)

028E accept/decline/withdraw, 028G notifications, 028F reschedule, anti-spam rate env, `capabilities.meetupInvites` **DEFERRED**, full Neon regression MDWQ-0099.

---

## Files (primary)

- `src/modules/meetup-invites/meetup-invite.{service,controller,routes,mapper,dto,validation,access,expiry,idempotency}.ts`
- `src/modules/social/social-access.ts` (activation fields on target select)
- `src/app.ts`
- `openapi/meetup-invites.yaml`
- `tests/integration/meetup-invite-028d.integration.test.ts`
