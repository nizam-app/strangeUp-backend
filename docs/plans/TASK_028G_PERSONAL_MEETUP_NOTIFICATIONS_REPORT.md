# Task 028G — Personal meetup notifications (implementation)

**Date:** 2026-10-29  
**Scope:** In-app notifications + push outbox enqueue for four meetup lifecycle events. No production FCM. **`capabilities.meetupInvites` remains DEFERRED.**

## Migration

`prisma/migrations/20261029180000_task028g_meetup_notifications/migration.sql`

- Extends `UserNotificationType` with four `MEETUP_INVITATION_*` values.
- Adds `UserNotificationPreference.meetupInvitesEnabled` (default `true`).

Applied to **strangeup_test** via `scripts/migrate-integration-only.ts`. **strangeup_dev:** owner runs `npm run db:neon:migrate` when ready.

## Source

| File | Change |
|------|--------|
| `meetup-invite-notifications.ts` | Dedupe keys, generic copy, eligibility gate, `emitInTransaction` |
| `meetup-invite.service.ts` | Create + successful mutations emit inside same DB transaction |
| `push-payload.ts`, `push-eligibility.ts` | Meetup types + preference mapping |
| `notification-preference.service.ts` + validation | `meetupInvitesEnabled` |
| `openapi/push-devices.yaml` | Preference field |

## Events

| Trigger | Type | Recipient |
|---------|------|-----------|
| New invite | `MEETUP_INVITATION_RECEIVED` | Recipient |
| Accept | `MEETUP_INVITATION_ACCEPTED` | Sender |
| Decline | `MEETUP_INVITATION_DECLINED` | Sender |
| Withdraw | `MEETUP_INVITATION_WITHDRAWN` | Recipient |

Dedupe: `meetup-invite:{inviteId}:received|accepted|declined|withdrawn`.  
`actorUserId` always **null** (no identity in content). `sourceId` = invite UUID.

## Delivery gaps (documented)

- **Emit time:** Task 022 + block check; ineligible recipient → skip notify, HTTP succeeds.
- **Push send time:** Worker re-checks activation, blocks (via eligibility loader), and `meetupInvitesEnabled` / `PUSH_ENABLED`. In-app row may exist while push is SKIPPED.
- **Post-delivery:** Block after notification created does not delete row; actor preview stays null for meetup types.

## Tests

| Suite | Result |
|-------|--------|
| `tests/meetup-invite-notifications.test.ts` | 3 unit tests |
| `tests/integration/meetup-invite-028g-notifications.integration.test.ts` | **9/9** Neon |
| `tests/integration/meetup-invite-028e.integration.test.ts` | **8/8** regression |

Commands: `npm run typecheck`, `lint`, `build`, `npm test -- --run` (**279** units), `RUN_INTEGRATION=1 npm run test:integration -- meetup-invite-028g…`.

**STOP:** 028H not started. 028F reschedule deferred (MDWQ-0724).
